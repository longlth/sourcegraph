import classNames from 'classnames'
import DotsHorizontalIcon from 'mdi-react/DotsHorizontalIcon'
import LockIcon from 'mdi-react/LockIcon'
import WebIcon from 'mdi-react/WebIcon'
import React, { useCallback, useState } from 'react'

import { Menu, MenuButton, MenuDivider, MenuItem, MenuItems, MenuPopover } from '@sourcegraph/wildcard'

import { deleteNotebook as _deleteNotebook } from './backend'
import { DeleteNotebookModal } from './DeleteNotebookModal'
import styles from './SearchNotebookPageHeaderActions.module.scss'

export interface SearchNotebookPageHeaderActionsProps {
    notebookId: string
    viewerCanManage: boolean
    isPublic: boolean
    onUpdateVisibility: (isPublic: boolean) => void
    deleteNotebook: typeof _deleteNotebook
}

export const SearchNotebookPageHeaderActions: React.FunctionComponent<SearchNotebookPageHeaderActionsProps> = ({
    notebookId,
    viewerCanManage,
    isPublic,
    onUpdateVisibility,
    deleteNotebook,
}) => (
    <div className="d-flex align-items-center">
        <NotebookVisibilityDropdown
            isPublic={isPublic}
            viewerCanManage={viewerCanManage}
            onUpdateVisibility={onUpdateVisibility}
        />
        {viewerCanManage && <NotebookSettingsDropdown notebookId={notebookId} deleteNotebook={deleteNotebook} />}
    </div>
)

interface NotebookSettingsDropdownProps {
    notebookId: string
    deleteNotebook: typeof _deleteNotebook
}

const NotebookSettingsDropdown: React.FunctionComponent<NotebookSettingsDropdownProps> = ({
    notebookId,
    deleteNotebook,
}) => {
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const toggleDeleteModal = useCallback(() => setShowDeleteModal(show => !show), [setShowDeleteModal])

    return (
        <>
            <Menu>
                {() => (
                    <>
                        <MenuButton className="btn btn-outline">
                            <DotsHorizontalIcon />
                        </MenuButton>
                        <MenuPopover>
                            <MenuItems>
                                <MenuItem disabled={true} onSelect={() => {}}>
                                    Settings
                                </MenuItem>
                                <MenuDivider />
                                <MenuItem className="btn-danger" onSelect={() => setShowDeleteModal(true)}>
                                    Delete notebook
                                </MenuItem>
                            </MenuItems>
                        </MenuPopover>
                    </>
                )}
            </Menu>
            <DeleteNotebookModal
                notebookId={notebookId}
                isOpen={showDeleteModal}
                toggleDeleteModal={toggleDeleteModal}
                deleteNotebook={deleteNotebook}
            />
        </>
    )
}

interface NotebookVisibilityDropdownProps {
    isPublic: boolean
    viewerCanManage: boolean
    onUpdateVisibility: (isPublic: boolean) => void
}

const NotebookVisibilityDropdown: React.FunctionComponent<NotebookVisibilityDropdownProps> = ({
    isPublic: initialIsPublic,
    onUpdateVisibility,
    viewerCanManage,
}) => {
    const [isPublic, setIsPublic] = useState(initialIsPublic)

    const updateVisibility = useCallback(
        (isPublic: boolean) => {
            onUpdateVisibility(isPublic)
            setIsPublic(isPublic)
        },
        [onUpdateVisibility, setIsPublic]
    )

    return (
        <Menu>
            {() => (
                <>
                    <MenuButton
                        className={classNames('btn', viewerCanManage && 'btn-outline')}
                        disabled={!viewerCanManage}
                    >
                        {isPublic ? (
                            <span>
                                <WebIcon className="icon-inline" /> Public
                            </span>
                        ) : (
                            <span>
                                <LockIcon className="icon-inline" /> Private
                            </span>
                        )}
                    </MenuButton>
                    <MenuPopover>
                        <MenuItems>
                            <MenuItem disabled={true} onSelect={() => {}}>
                                Change notebook visibility
                            </MenuItem>
                            <MenuDivider />
                            <MenuItem
                                onSelect={() => updateVisibility(false)}
                                className={styles.visibilityDropdownItem}
                            >
                                <div>
                                    <LockIcon className="icon-inline" /> Private
                                </div>
                                <div>
                                    <strong>Only you</strong> will be able to view the notebook.
                                </div>
                            </MenuItem>
                            <MenuItem onSelect={() => updateVisibility(true)} className={styles.visibilityDropdownItem}>
                                <div>
                                    <WebIcon className="icon-inline" /> Public
                                </div>
                                <div>
                                    <strong>Everyone</strong> will be able to view the notebook.
                                </div>
                            </MenuItem>
                        </MenuItems>
                    </MenuPopover>
                </>
            )}
        </Menu>
    )
}
