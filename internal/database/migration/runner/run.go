package runner

import (
	"context"
	"fmt"

	"github.com/cockroachdb/errors"
	"github.com/inconshreveable/log15"
)

type Options struct {
	Operations []MigrationOperation

	// Parallel controls whether we run schema migrations concurrently or not. By default,
	// we run schema migrations sequentially. This is to ensure that in testing, where the
	// same database can be targetted by multiple schemas, we do not hit errors that occur
	// when trying to install Postgres extensions concurrently (which do not seem txn-safe).
	Parallel bool
}

type MigrationOperation struct {
	SchemaName     string
	Type           MigrationOperationType
	TargetVersions []int
}

type MigrationOperationType int

const (
	MigrationOperationTypeTargetedUp MigrationOperationType = iota
	MigrationOperationTypeTargetedDown
	MigrationOperationTypeTargetedUpgrade
	MigrationOperationTypeTargetedRevert
)

func (r *Runner) Run(ctx context.Context, options Options) error {
	schemaNames := make([]string, 0, len(options.Operations))
	for _, operation := range options.Operations {
		schemaNames = append(schemaNames, operation.SchemaName)
	}

	operationMap := make(map[string]MigrationOperation, len(options.Operations))
	for _, operation := range options.Operations {
		operationMap[operation.SchemaName] = operation
	}
	if len(operationMap) != len(options.Operations) {
		return fmt.Errorf("multiple operations defined on the same schema")
	}

	numRoutines := 1
	if options.Parallel {
		numRoutines = len(schemaNames)
	}
	semaphore := make(chan struct{}, numRoutines)

	return r.forEachSchema(ctx, schemaNames, func(ctx context.Context, schemaName string, schemaContext schemaContext) error {
		// Block until we can write into this channel. This ensures that we only have at most
		// the same number of active goroutines as we have slots in the channel's buffer.
		semaphore <- struct{}{}
		defer func() { <-semaphore }()

		if err := r.runSchema(ctx, operationMap[schemaName], schemaContext); err != nil {
			return errors.Wrapf(err, "failed to run migration for schema %q", schemaName)
		}

		return nil
	})
}

func (r *Runner) runSchema(ctx context.Context, operation MigrationOperation, schemaContext schemaContext) (err error) {
	// Determine if we are upgrading to the latest schema. There are some properties around
	// contention which we want to accept on normal "upgrade to latest" behavior, but want to
	// alert on when a user is downgrading or upgrading to a specific version.
	upgradingToLatest := operation.Type == MigrationOperationTypeTargetedUpgrade

	if !upgradingToLatest {
		if len(schemaContext.schemaVersion.failedVersions) > 0 {
			return errDirtyDatabase
		}

		// If there are pending migrations, then either the last attempted migration had failed,
		// or another migrator is currently running and holding an advisory lock. If we're not
		// migrating to the latest schema, concurrent migrations may have unexpected behavior.
		// In either case, we'll early exit here.

		if len(schemaContext.schemaVersion.pendingVersions) > 0 {
			acquired, unlock, err := schemaContext.store.TryLock(ctx)
			if err != nil {
				return err
			}
			defer func() { err = unlock(err) }()

			if !acquired {
				// Some other migration process is holding the lock
				return errMigrationContention
			}

			return errDirtyDatabase
		}
	}

	if acquired, unlock, err := schemaContext.store.Lock(ctx); err != nil {
		return err
	} else if !acquired {
		return fmt.Errorf("failed to acquire migration lock")
	} else {
		defer func() { err = unlock(err) }()
	}

	schemaVersion, err := r.fetchVersion(ctx, schemaContext.schema.Name, schemaContext.store)
	if err != nil {
		return err
	}
	if !upgradingToLatest {
		// Check if another instance changed the schema version before we acquired the
		// lock. If we're not migrating to the latest schema, concurrent migrations may
		// have unexpected behavior. We'll early exit here.

		if !compareSchemaVersions(schemaContext.schemaVersion, schemaVersion) {
			return errMigrationContention
		}
	}
	if len(schemaVersion.pendingVersions)+len(schemaVersion.failedVersions) > 0 {
		// The store layer will refuse to alter a dirty database. We'll return an error
		// here instead of from the store as we can provide a bit instruction to the user
		// at this point.
		return errDirtyDatabase
	}

	switch operation.Type {
	case MigrationOperationTypeTargetedUpgrade:
		leaves := schemaContext.schema.Definitions.Leaves()
		leafIDs := make([]int, 0, len(leaves))
		for _, leaf := range leaves {
			leafIDs = append(leafIDs, leaf.ID)
		}

		operation = MigrationOperation{
			SchemaName:     operation.SchemaName,
			Type:           MigrationOperationTypeTargetedUp,
			TargetVersions: leafIDs,
		}

	case MigrationOperationTypeTargetedRevert:
		counts := make(map[int]int, len(schemaContext.schemaVersion.appliedVersions))
		for _, id := range schemaContext.schemaVersion.appliedVersions {
			counts[id] = 0
		}

		for _, id := range schemaContext.schemaVersion.appliedVersions {
			definition, ok := schemaContext.schema.Definitions.GetByID(id)
			if !ok {
				return fmt.Errorf("unknown version %d", id)
			}

			for _, parent := range definition.Metadata.Parents {
				counts[parent]++
			}
		}

		leafIDs := make([]int, 0, len(counts))
		for k, v := range counts {
			if v == 0 {
				leafIDs = append(leafIDs, k)
			}
		}
		if len(leafIDs) != 1 {
			return fmt.Errorf("ambiguous revert")
		}

		operation = MigrationOperation{
			SchemaName:     operation.SchemaName,
			Type:           MigrationOperationTypeTargetedDown,
			TargetVersions: leafIDs,
		}
	}

	switch operation.Type {
	case MigrationOperationTypeTargetedUp:
		return r.runSchemaUp(ctx, operation, schemaContext)
	case MigrationOperationTypeTargetedDown:
		return r.runSchemaDown(ctx, operation, schemaContext)

	default:
		return fmt.Errorf("unknown operation type '%v'", operation.Type)
	}
}

func (r *Runner) runSchemaUp(ctx context.Context, operation MigrationOperation, schemaContext schemaContext) (err error) {
	log15.Info("Upgrading schema", "schema", schemaContext.schema.Name)

	definitions, err := schemaContext.schema.Definitions.Up(schemaContext.schemaVersion.appliedVersions, operation.TargetVersions)
	if err != nil {
		return err
	}

	for _, definition := range definitions {
		log15.Info("Running up migration", "schema", schemaContext.schema.Name, "migrationID", definition.ID)

		if err := schemaContext.store.Up(ctx, definition); err != nil {
			return errors.Wrapf(err, "failed upgrade migration %d", definition.ID)
		}
	}

	return nil
}

func (r *Runner) runSchemaDown(ctx context.Context, operation MigrationOperation, schemaContext schemaContext) error {
	log15.Info("Downgrading schema", "schema", schemaContext.schema.Name)

	definitions, err := schemaContext.schema.Definitions.Down(schemaContext.schemaVersion.appliedVersions, operation.TargetVersions)
	if err != nil {
		return err
	}

	for _, definition := range definitions {
		log15.Info("Running down migration", "schema", schemaContext.schema.Name, "migrationID", definition.ID)

		if err := schemaContext.store.Down(ctx, definition); err != nil {
			return errors.Wrapf(err, "failed downgrade migration %d", definition.ID)
		}
	}

	return nil
}

func compareSchemaVersions(a, b schemaVersion) bool {
	return true &&
		compareVersionSlice(a.pendingVersions, b.pendingVersions) &&
		compareVersionSlice(a.failedVersions, b.failedVersions) &&
		compareVersionSlice(a.appliedVersions, b.appliedVersions)
}
