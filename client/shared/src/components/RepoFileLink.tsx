import * as React from 'react'

import { appendSubtreeQueryParameter, displayRepoName } from '@sourcegraph/common/src/util/url'
import { Link } from '@sourcegraph/wildcard'

/**
 * Splits the repository name into the dir and base components.
 */
export function splitPath(path: string): [string, string] {
    const components = path.split('/')
    return [components.slice(0, -1).join('/'), components[components.length - 1]]
}

interface Props {
    repoName: string
    repoURL: string
    filePath: string
    fileURL: string
    repoDisplayName?: string
    className?: string
}

/**
 * A link to a repository or a file within a repository, formatted as "repo" or "repo > file". Unless you
 * absolutely need breadcrumb-like behavior, use this instead of FilePathBreadcrumb.
 */
export const RepoFileLink: React.FunctionComponent<Props> = ({
    repoDisplayName,
    repoName,
    repoURL,
    filePath,
    fileURL,
    className,
}) => {
    const [fileBase, fileName] = splitPath(filePath)
    return (
        <div className={className}>
            <Link to={repoURL}>{repoDisplayName || displayRepoName(repoName)}</Link> ›{' '}
            <Link to={appendSubtreeQueryParameter(fileURL)}>
                {fileBase ? `${fileBase}/` : null}
                <strong>{fileName}</strong>
            </Link>
        </div>
    )
}
