import classNames from 'classnames'
import React from 'react'

import { Link } from '@sourcegraph/shared/src/components/Link'

import { DiffStat } from '../../../components/diff/DiffStat'
import {
    ConnectionContainer,
    ConnectionError,
    ConnectionForm,
    ConnectionList,
    ConnectionLoading,
    ConnectionSummary,
    ShowMoreButton,
    SummaryContainer,
} from '../../../components/FilteredConnection/ui'
import { BatchSpecWorkspaceListFields, Scalars } from '../../../graphql-operations'
import { Branch } from '../Branch'

import { useWorkspacesListConnection } from './backend'
import styles from './WorkspacesList.module.scss'
import { WorkspaceStateIcon } from './WorkspaceStateIcon'

export interface WorkspacesListProps {
    batchSpecID: Scalars['ID']
    /** The currently selected workspace node id. Will be highlighted. */
    selectedNode?: Scalars['ID']
}

export const WorkspacesList: React.FunctionComponent<WorkspacesListProps> = ({ batchSpecID, selectedNode }) => {
    const { loading, hasNextPage, fetchMore, connection, error } = useWorkspacesListConnection(batchSpecID)

    return (
        <ConnectionContainer>
            {error && <ConnectionError errors={[error.message]} />}
            <ConnectionForm
                // ref={this.setFilterRef}
                hideSearch={true}
                // inputClassName={this.props.inputClassName}
                inputPlaceholder="Search workspaces..."
                inputValue={this.state.query}
                onInputChange={this.onChange}
                autoFocus={this.props.autoFocus}
                filters={this.props.filters}
                onValueSelect={this.onDidSelectValue}
                values={this.state.activeValues}
                compact={this.props.compact}
                // formClassName={this.props.formClassName}
            />
            <ConnectionList as="ul" className="list-group list-group-flush">
                {connection?.nodes?.map(node => (
                    <WorkspaceNode key={node.id} node={node} selectedNode={selectedNode} />
                ))}
            </ConnectionList>
            {/* We don't want to flash a loader on reloads: */}
            {loading && !connection && <ConnectionLoading />}
            {connection && (
                <SummaryContainer centered={true}>
                    <ConnectionSummary
                        noSummaryIfAllNodesVisible={true}
                        first={20}
                        connection={connection}
                        noun="workspace"
                        pluralNoun="workspaces"
                        hasNextPage={hasNextPage}
                    />
                    {hasNextPage && <ShowMoreButton centered={true} onClick={fetchMore} />}
                </SummaryContainer>
            )}
        </ConnectionContainer>
    )
}

interface WorkspaceNodeProps {
    node: BatchSpecWorkspaceListFields
    selectedNode?: Scalars['ID']
}

const WorkspaceNode: React.FunctionComponent<WorkspaceNodeProps> = ({ node, selectedNode }) => (
    <li className={classNames('list-group-item', node.id === selectedNode && styles.workspaceSelected)}>
        <Link to={`?workspace=${node.id}`}>
            <div className={classNames(styles.workspaceRepo, 'd-flex justify-content-between mb-1')}>
                <span>
                    <WorkspaceStateIcon
                        cachedResultFound={node.cachedResultFound}
                        state={node.state}
                        className={classNames(styles.workspaceListIcon, 'mr-2 flex-shrink-0')}
                    />
                </span>
                <strong className={classNames(styles.workspaceName, 'flex-grow-1')}>{node.repository.name}</strong>
                {node.diffStat && <DiffStat {...node.diffStat} expandedCounts={true} />}
            </div>
            <Branch name={node.branch.abbrevName} />
        </Link>
    </li>
)
