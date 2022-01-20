import React, { ReactNode } from 'react'

import { renderMarkdown } from '@sourcegraph/common/src/util/markdown'
import { buildSearchURLQuery } from '@sourcegraph/common/src/util/url'
import { Markdown } from '@sourcegraph/shared/src/components/Markdown'
import { AggregateStreamingSearchResults } from '@sourcegraph/shared/src/search/stream'
import { Button, Link } from '@sourcegraph/wildcard'

import { SearchPatternType } from '../../graphql-operations'

interface SearchAlertProps {
    alert: Required<AggregateStreamingSearchResults>['alert']
    patternType: SearchPatternType | undefined
    caseSensitive: boolean
    searchContextSpec?: string
    children?: ReactNode[]
}

export const SearchAlert: React.FunctionComponent<SearchAlertProps> = ({
    alert,
    patternType,
    caseSensitive,
    searchContextSpec,
    children,
}) => (
    <div className="alert alert-info my-2 mr-3" data-testid="alert-container">
        <h3>{alert.title}</h3>

        {alert.description && <Markdown className="mb-3" dangerousInnerHTML={renderMarkdown(alert.description)} />}

        {alert.proposedQueries && (
            <>
                <h4>Did you mean:</h4>
                <ul className="list-unstyled">
                    {alert.proposedQueries.map(proposedQuery => (
                        <li key={proposedQuery.query}>
                            <Button
                                data-testid="proposed-query-link"
                                to={
                                    '/search?' +
                                    buildSearchURLQuery(
                                        proposedQuery.query,
                                        patternType || SearchPatternType.literal,
                                        caseSensitive,
                                        searchContextSpec
                                    )
                                }
                                variant="secondary"
                                size="sm"
                                as={Link}
                            >
                                {proposedQuery.query || proposedQuery.description}
                            </Button>
                            {proposedQuery.query && proposedQuery.description && ` — ${proposedQuery.description}`}
                        </li>
                    ))}
                </ul>
            </>
        )}

        {children}
    </div>
)
