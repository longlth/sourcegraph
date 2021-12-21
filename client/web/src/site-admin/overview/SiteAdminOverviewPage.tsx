import OpenInNewIcon from 'mdi-react/OpenInNewIcon'
import React, { useEffect, useMemo } from 'react'
import { Observable, of } from 'rxjs'
import { map, catchError } from 'rxjs/operators'

import { LoadingSpinner } from '@sourcegraph/react-loading-spinner'
import { ActivationProps, percentageDone } from '@sourcegraph/shared/src/components/activation/Activation'
import { ActivationChecklist } from '@sourcegraph/shared/src/components/activation/ActivationChecklist'
import { Link } from '@sourcegraph/shared/src/components/Link'
import { dataOrThrowErrors, gql } from '@sourcegraph/shared/src/graphql/graphql'
import * as GQL from '@sourcegraph/shared/src/graphql/schema'
import { ThemeProps } from '@sourcegraph/shared/src/theme'
import { ErrorLike, asError, isErrorLike } from '@sourcegraph/shared/src/util/errors'
import { numberWithCommas, pluralize } from '@sourcegraph/shared/src/util/strings'
import { useObservable } from '@sourcegraph/shared/src/util/useObservable'
import { Button } from '@sourcegraph/wildcard'

import { queryGraphQL } from '../../backend/graphql'
import { ErrorAlert } from '../../components/alerts'
import { Collapsible } from '../../components/Collapsible'
import { PageTitle } from '../../components/PageTitle'
import { Scalars } from '../../graphql-operations'
import { eventLogger } from '../../tracking/eventLogger'
import { UsageChart } from '../SiteAdminUsageStatisticsPage'

interface Props extends ActivationProps, ThemeProps {
    overviewComponents: readonly React.ComponentType[]

    /** For testing only */
    _fetchOverview?: () => Observable<{
        repositories: number | null
        repositoryStats: {
            gitDirBytes: Scalars['BigInt']
            indexedLinesCount: Scalars['BigInt']
        }
        users: number
        orgs: number
        surveyResponses: {
            totalCount: number
            averageScore: number
        }
    }>
    /** For testing only */
    _fetchWeeklyActiveUsers?: () => Observable<GQL.ISiteUsageStatistics>
}

const fetchOverview = (): Observable<{
    repositories: number | null
    repositoryStats: {
        gitDirBytes: Scalars['BigInt']
        indexedLinesCount: Scalars['BigInt']
    }
    users: number
    orgs: number
    surveyResponses: {
        totalCount: number
        averageScore: number
    }
}> =>
    queryGraphQL(gql`
        query Overview {
            repositories {
                totalCount(precise: true)
            }
            repositoryStats {
                gitDirBytes
                indexedLinesCount
            }
            users {
                totalCount
            }
            organizations {
                totalCount
            }
            surveyResponses {
                totalCount
                averageScore
            }
        }
    `).pipe(
        map(dataOrThrowErrors),
        map(data => ({
            repositories: data.repositories.totalCount,
            repositoryStats: data.repositoryStats,
            users: data.users.totalCount,
            orgs: data.organizations.totalCount,
            surveyResponses: data.surveyResponses,
        }))
    )

const fetchWeeklyActiveUsers = (): Observable<GQL.ISiteUsageStatistics> =>
    queryGraphQL(gql`
        query WAUs {
            site {
                usageStatistics {
                    waus {
                        userCount
                        registeredUserCount
                        anonymousUserCount
                        startTime
                    }
                }
            }
        }
    `).pipe(
        map(dataOrThrowErrors),
        map(data => data.site.usageStatistics)
    )

/**
 * A page displaying an overview of site admin information.
 */
export const SiteAdminOverviewPage: React.FunctionComponent<Props> = ({
    isLightTheme,
    activation,
    overviewComponents,
    _fetchOverview = fetchOverview,
    _fetchWeeklyActiveUsers = fetchWeeklyActiveUsers,
}) => {
    useEffect(() => {
        eventLogger.logViewEvent('SiteAdminOverview')
    }, [])

    const info = useObservable(
        useMemo(() => _fetchOverview().pipe(catchError(error => of<ErrorLike>(asError(error)))), [_fetchOverview])
    )

    const stats = useObservable(
        useMemo(() => _fetchWeeklyActiveUsers().pipe(catchError(error => of<ErrorLike>(asError(error)))), [
            _fetchWeeklyActiveUsers,
        ])
    )

    let setupPercentage = 0
    if (activation) {
        setupPercentage = percentageDone(activation.completed)
    }
    return (
        <div className="site-admin-overview-page">
            <PageTitle title="Overview - Admin" />
            {overviewComponents.length > 0 && (
                <div className="mb-4">
                    {overviewComponents.map((Component, index) => (
                        <Component key={index} />
                    ))}
                </div>
            )}
            {info === undefined && <LoadingSpinner className="icon-inline" />}
            <div className="pt-3 mb-4">
                {activation?.completed && (
                    <Collapsible
                        title={
                            <div className="p-2">
                                {setupPercentage > 0 && setupPercentage < 100
                                    ? 'Almost there!'
                                    : 'Welcome to Sourcegraph'}
                            </div>
                        }
                        detail={
                            setupPercentage < 100 ? 'Complete the steps below to finish onboarding to Sourcegraph' : ''
                        }
                        defaultExpanded={setupPercentage < 100}
                        className="p-0 list-group-item font-weight-normal test-site-admin-overview-menu"
                        buttonClassName="mb-0 py-3 px-3"
                        titleClassName="h5 mb-0 font-weight-bold"
                        detailClassName="h5 mb-0 font-weight-normal"
                        titleAtStart={true}
                    >
                        {activation.completed && (
                            <ActivationChecklist
                                steps={activation.steps}
                                completed={activation.completed}
                                buttonClassName="h5 mb-0 font-weight-normal"
                            />
                        )}
                    </Collapsible>
                )}
            </div>

            <div className="list-group">
                {info && !isErrorLike(info) && (
                    <>
                        {info.repositories !== null && (
                            <Link
                                to="/site-admin/repositories"
                                className="list-group-item list-group-item-action h5 mb-0 font-weight-normal py-2 px-3"
                            >
                                {numberWithCommas(info.repositories)}{' '}
                                {pluralize('repository', info.repositories, 'repositories')}
                            </Link>
                        )}
                        {info.repositoryStats !== null && (
                            <Link
                                to="/site-admin/repositories"
                                className="list-group-item list-group-item-action h5 mb-0 font-weight-normal py-2 px-3"
                            >
                                {BigInt(info.repositoryStats.gitDirBytes).toLocaleString()}{' '}
                                {pluralize('byte stored', BigInt(info.repositoryStats.gitDirBytes), 'bytes stored')}
                            </Link>
                        )}
                        {info.repositoryStats !== null && (
                            <Link
                                to="/site-admin/repositories"
                                className="list-group-item list-group-item-action h5 mb-0 font-weight-normal py-2 px-3"
                            >
                                {BigInt(info.repositoryStats.indexedLinesCount).toLocaleString()}{' '}
                                {pluralize(
                                    'line of code indexed',
                                    BigInt(info.repositoryStats.indexedLinesCount),
                                    'lines of code indexed'
                                )}
                            </Link>
                        )}
                        {info.users > 1 && (
                            <Link
                                to="/site-admin/users"
                                className="list-group-item list-group-item-action h5 mb-0 font-weight-normal py-2 px-3"
                            >
                                {numberWithCommas(info.users)} {pluralize('user', info.users)}
                            </Link>
                        )}
                        {info.orgs > 1 && (
                            <Link
                                to="/site-admin/organizations"
                                className="list-group-item list-group-item-action h5 mb-0 font-weight-normal py-2 px-3"
                            >
                                {numberWithCommas(info.orgs)} {pluralize('organization', info.orgs)}
                            </Link>
                        )}
                        {info.users > 1 && (
                            <Link
                                to="/site-admin/surveys"
                                className="list-group-item list-group-item-action h5 mb-0 font-weight-normal py-2 px-3"
                            >
                                {numberWithCommas(info.surveyResponses.totalCount)}{' '}
                                {pluralize('user survey response', info.surveyResponses.totalCount)}
                            </Link>
                        )}
                        {info.users > 1 &&
                            stats !== undefined &&
                            (isErrorLike(stats) ? (
                                <ErrorAlert className="mb-3" error={stats} />
                            ) : (
                                <Collapsible
                                    title={
                                        <>
                                            {stats.waus[1].userCount}{' '}
                                            {pluralize('active user', stats.waus[1].userCount)} last week
                                        </>
                                    }
                                    defaultExpanded={true}
                                    className="list-group-item"
                                    titleClassName="h5 mb-0 font-weight-normal p-2"
                                    titleAtStart={true}
                                >
                                    {stats && (
                                        <UsageChart
                                            isLightTheme={isLightTheme}
                                            stats={stats}
                                            chartID="waus"
                                            showLegend={false}
                                            header={
                                                <div className="site-admin-overview-page__detail-header">
                                                    <h2>Weekly unique users</h2>
                                                    <h3>
                                                        <Button
                                                            to="/site-admin/usage-statistics"
                                                            variant="secondary"
                                                            as={Link}
                                                        >
                                                            View all usage statistics{' '}
                                                            <OpenInNewIcon className="icon-inline" />
                                                        </Button>
                                                    </h3>
                                                </div>
                                            }
                                        />
                                    )}
                                </Collapsible>
                            ))}
                    </>
                )}
            </div>
        </div>
    )
}
