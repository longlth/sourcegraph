package runner

import (
	"context"
	"strings"
	"testing"
)

func TestRunnerValidate(t *testing.T) {
	overrideSchemas(t)
	ctx := context.Background()

	// t.Run("very old schema", func(t *testing.T) {
	// 	store := testStoreWithVersion(250, false)

	// 	outOfDateError := new(SchemaOutOfDateError)
	// 	if err := makeTestRunner(t, store).Validate(ctx, "well-formed"); !errors.As(err, &outOfDateError) || cmp.Diff(outOfDateError.missingVersions, []int{10003}) != "" {
	// 		t.Fatalf("unexpected error running validation. want=(unexpected version; expected 10003, currently 250) have=%s", err)
	// 	}
	// })

	// t.Run("old schema", func(t *testing.T) {
	// 	store := testStoreWithVersion(10001, false)

	// 	outOfDateError := new(SchemaOutOfDateError)
	// 	if err := makeTestRunner(t, store).Validate(ctx, "well-formed"); !errors.As(err, &outOfDateError) || cmp.Diff(outOfDateError.missingVersions, []int{10003}) != "" {
	// 		t.Fatalf("unexpected error running validation. want=(unexpected version; expected 10003, currently 10001) have=%s", err)
	// 	}
	// })

	t.Run("correct version", func(t *testing.T) {
		store := testStoreWithVersion(10003, false)

		if err := makeTestRunner(t, store).Validate(ctx, "well-formed"); err != nil {
			t.Fatalf("unexpected error running validation: %s", err)
		}
	})

	t.Run("future schema", func(t *testing.T) {
		store := testStoreWithVersion(10004, false)

		if err := makeTestRunner(t, store).Validate(ctx, "well-formed"); err != nil {
			t.Fatalf("unexpected error running validation: %s", err)
		}
	})

	// t.Run("distant future schema", func(t *testing.T) {
	// 	store := testStoreWithVersion(50010, false)

	// 	if err := makeTestRunner(t, store).Validate(ctx, "well-formed"); err != nil {
	// 		t.Fatalf("unexpected error running validation: %s", err)
	// 	}
	// })

	t.Run("dirty database", func(t *testing.T) {
		store := testStoreWithVersion(10003, true)

		if err := makeTestRunner(t, store).Validate(ctx, "well-formed"); err == nil || !strings.Contains(err.Error(), "dirty database") {
			t.Fatalf("unexpected error running validation. want=%q have=%q", "dirty database", err)
		}
	})

	// t.Run("dirty future database", func(t *testing.T) {
	// 	store := testStoreWithVersion(50003, true)

	// 	if err := makeTestRunner(t, store).Validate(ctx, "well-formed"); err != nil {
	// 		t.Fatalf("unexpected error running validation: %s", err)
	// 	}
	// })

	t.Run("migration contention", func(t *testing.T) {
		store := testStoreWithVersion(10015, false)
		store.VersionsFunc.PushReturn(nil, []int{10013}, nil, nil)
		store.VersionsFunc.PushReturn([]int{10013}, []int{10014}, nil, nil)
		store.VersionsFunc.PushReturn([]int{10013, 10014}, []int{10015}, nil, nil)

		if err := makeTestRunner(t, store).Validate(ctx, "well-formed"); err != nil {
			t.Fatalf("unexpected error running validation: %s", err)
		}
	})
}
