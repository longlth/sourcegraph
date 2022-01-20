package runner

import (
	"context"
	"fmt"

	"github.com/sourcegraph/sourcegraph/internal/database/migration/definition"
)

func (r *Runner) Validate(ctx context.Context, schemaNames ...string) error {
	return r.forEachSchema(ctx, schemaNames, func(ctx context.Context, schemaName string, schemaContext schemaContext) error {
		return r.validateSchema(ctx, schemaName, schemaContext)
	})
}

func (r *Runner) validateSchema(ctx context.Context, schemaName string, schemaContext schemaContext) error {
	// If database version is strictly newer, then we have a deployment in-process. The current
	// instance has what it needs to run, so we should be good with that. Do not crash here if
	// the database is is dirty, as that would cause a troublesome deployment to cause outages
	// on the old instance (which seems stressful, don't do that).
	if isDatabaseNewer(schemaContext.schemaVersion.appliedVersions, schemaContext.schema.Definitions) {
		return nil
	}

	appliedVersions, dirty, err := r.waitForMigration(ctx, schemaName, schemaContext)
	if err != nil {
		return err
	}

	// Note: No migrator instances seem to be running indicating that the dirty flag indicates
	// an actual migration failure that needs attention from a site administrator. We'll handle
	// the dirty flag selectively below.

	leaves := schemaContext.schema.Definitions.Leaves()
	leafIDs := make([]int, 0, len(leaves))
	for _, leaf := range leaves {
		leafIDs = append(leafIDs, leaf.ID)
	}

	definitions, err := schemaContext.schema.Definitions.Up(appliedVersions, leafIDs)
	if err != nil {
		// An error here means we might just be a very old instance. In order to figure out what
		// version we expect to be at, we re-query from a "blank" database so that we can take
		// populate the definitions variable in the error construction in the function below.

		allDefinitions := schemaContext.schema.Definitions.All()
		if len(allDefinitions) == 0 {
			return err
		}

		missingVersions := make([]int, 0, len(allDefinitions))
		for _, definition := range allDefinitions {
			missingVersions = append(missingVersions, definition.ID)
		}

		return &SchemaOutOfDateError{
			schemaName:      schemaName,
			missingVersions: missingVersions,
		}
	}
	if dirty {
		// Check again to see if the database is newer and ignore the dirty flag here as well.
		if isDatabaseNewer(appliedVersions, schemaContext.schema.Definitions) {
			return nil
		}

		// We have migrations to run but won't be able to run them
		return errDirtyDatabase
	}

	if len(definitions) == 0 {
		// No migrations to run, up to date
		return nil
	}

	missingVersions := make([]int, 0, len(definitions))
	for _, definition := range definitions {
		missingVersions = append(missingVersions, definition.ID)
	}

	return &SchemaOutOfDateError{
		schemaName:      schemaName,
		missingVersions: missingVersions,
	}
}

// waitForMigration polls the store for the version while taking an advisory lock. We do
// this while a migrator seems to be running concurrently so that we do not fail fast on
// applications that would succeed after the migration finishes.
func (r *Runner) waitForMigration(ctx context.Context, schemaName string, schemaContext schemaContext) ([]int, bool, error) {
	version, dirty := schemaContext.schemaVersion.appliedVersions, len(schemaContext.schemaVersion.pendingVersions)+len(schemaContext.schemaVersion.failedVersions) > 0

	for dirty {
		// While the previous version of the schema we queried was marked as dirty, we
		// will block until we can acquire the migration lock, then re-check the version.
		schemaVersion, err := r.lockedVersion(ctx, schemaContext)
		if err != nil {
			return nil, false, err
		}
		if compareVersionSlice(schemaVersion.appliedVersions, version) {
			// Version didn't change, no migrator instance was running and we were able
			// to acquire the lock right away. Break from this loop otherwise we'll just
			// be busy-querying the same state.
			break
		}

		// Version changed, check again
		version, dirty = schemaVersion.appliedVersions, len(schemaVersion.pendingVersions)+len(schemaVersion.failedVersions) > 0
	}

	return version, dirty, nil
}

func (r *Runner) lockedVersion(ctx context.Context, schemaContext schemaContext) (_ schemaVersion, err error) {
	if locked, unlock, err := schemaContext.store.Lock(ctx); err != nil {
		return schemaVersion{}, err
	} else if !locked {
		return schemaVersion{}, fmt.Errorf("failed to acquire migration lock")
	} else {
		defer func() { err = unlock(err) }()
	}

	return r.fetchVersion(ctx, schemaContext.schema.Name, schemaContext.store)
}

// isDatabaseNewer returns true if the given version is strictly larger than the maximum migration
// identifier we expect to have applied.
func isDatabaseNewer(appliedVersions []int, definitions *definition.Definitions) bool {
	appliedVersionsMap := make(map[int]struct{}, len(appliedVersions))
	for _, version := range appliedVersions {
		appliedVersionsMap[version] = struct{}{}
	}

	for _, definition := range definitions.All() {
		if _, ok := appliedVersionsMap[definition.ID]; !ok {
			return false
		}
	}

	return true
}

func compareVersionSlice(a, b []int) bool {
	if len(a) != len(b) {
		return false
	}

	for i, v := range a {
		if b[i] != v {
			return false
		}
	}

	return true
}
