import Dialog from '@reach/dialog'
import React from 'react'

import { Button } from '@sourcegraph/wildcard'

export interface ReplaceSpecModalProps {
    libraryItemName: string
    onCancel: () => void
    onConfirm: () => void
}

export const ReplaceSpecModal: React.FunctionComponent<ReplaceSpecModalProps> = ({
    libraryItemName,
    onCancel,
    onConfirm,
}) => (
    <Dialog
        className="modal-body modal-body--top-third p-4 rounded border"
        onDismiss={onCancel}
        aria-labelledby={MODAL_LABEL_ID}
    >
        <h3 id={MODAL_LABEL_ID}>Replace batch spec?</h3>
        <p className="mb-4">
            Are you sure you want to replace your current batch spec with the template for{' '}
            <strong>{libraryItemName}</strong>?
        </p>
        <div className="d-flex justify-content-end">
            <Button className="btn-outline-secondary mr-2" onClick={onCancel}>
                Cancel
            </Button>
            <Button onClick={onConfirm} variant="primary">
                Confirm
            </Button>
        </div>
    </Dialog>
)

const MODAL_LABEL_ID = 'replace-batch-spec-modal-title'
