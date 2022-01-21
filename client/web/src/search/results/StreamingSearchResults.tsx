import classNames from 'classnames'
import * as H from 'history'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Observable } from 'rxjs'

import { asError } from '@sourcegraph/common'
import { SearchContextProps } from '@sourcegraph/search'
import { SearchSidebar, StreamingProgress, StreamingSearchResultsList } from '@sourcegraph/search-ui'
import { ActivationProps } from '@sourcegraph/shared/src/components/activation/Activation'
import { FetchFileParameters } from '@sourcegraph/shared/src/components/CodeExcerpt'
import { CtaAlert } from '@sourcegraph/shared/src/components/CtaAlert'
import { ExtensionsControllerProps } from '@sourcegraph/shared/src/extensions/controller'
import { SearchPatternType } from '@sourcegraph/shared/src/graphql-operations'
import { PlatformContextProps } from '@sourcegraph/shared/src/platform/context'
import { collectMetrics } from '@sourcegraph/shared/src/search/query/metrics'
import { sanitizeQueryForTelemetry, updateFilters } from '@sourcegraph/shared/src/search/query/transformer'
import { StreamSearchOptions } from '@sourcegraph/shared/src/search/stream'
import { SettingsCascadeProps } from '@sourcegraph/shared/src/settings/settings'
import { TelemetryProps } from '@sourcegraph/shared/src/telemetry/telemetryService'
import { ThemeProps } from '@sourcegraph/shared/src/theme'
import { useLocalStorage, useObservable } from '@sourcegraph/wildcard'

import { SearchStreamingProps } from '..'
import { AuthenticatedUser } from '../../auth'
import { PageTitle } from '../../components/PageTitle'
import { FeatureFlagProps } from '../../featureFlags/featureFlags'
import { usePersistentCadence } from '../../hooks'
import { CodeInsightsProps } from '../../insights/types'
import { isCodeInsightsEnabled } from '../../insights/utils/is-code-insights-enabled'
import { OnboardingTour } from '../../onboarding-tour/OnboardingTour'
import { BrowserExtensionAlert } from '../../repo/actions/BrowserExtensionAlert'
import { SavedSearchModal } from '../../savedSearches/SavedSearchModal'
import {
    useExperimentalFeatures,
    useNavbarQueryState,
    useSearchStack,
    buildSearchURLQueryFromQueryState,
} from '../../stores'
import { browserExtensionInstalled } from '../../tracking/analyticsUtils'
import { SearchUserNeedsCodeHost } from '../../user/settings/codeHosts/OrgUserNeedsCodeHost'
import { SearchBetaIcon } from '../CtaIcons'
import { submitSearch } from '../helpers'

import { DidYouMean } from './DidYouMean'
import { SearchAlert } from './SearchAlert'
import { useCachedSearchResults } from './SearchResultsCacheProvider'
import { SearchResultsInfoBar } from './SearchResultsInfoBar'
import { getRevisions } from './sidebar/Revisions'
import styles from './StreamingSearchResults.module.scss'

export interface StreamingSearchResultsProps
    extends SearchStreamingProps,
        Pick<ActivationProps, 'activation'>,
        Pick<SearchContextProps, 'selectedSearchContextSpec' | 'searchContextsEnabled'>,
        SettingsCascadeProps,
        ExtensionsControllerProps<'executeCommand' | 'extHostAPI'>,
        PlatformContextProps<'forceUpdateTooltip' | 'settings' | 'requestGraphQL'>,
        TelemetryProps,
        ThemeProps,
        CodeInsightsProps,
        FeatureFlagProps {
    authenticatedUser: AuthenticatedUser | null
    location: H.Location
    history: H.History
    isSourcegraphDotCom: boolean

    fetchHighlightedFileLineRanges: (parameters: FetchFileParameters, force?: boolean) => Observable<string[][]>
}

// The latest supported version of our search syntax. Users should never be able to determine the search version.
// The version is set based on the release tag of the instance. Anything before 3.9.0 will not pass a version parameter,
// and will therefore default to V1.
export const LATEST_VERSION = 'V2'

const CTA_ALERTS_CADENCE_KEY = 'SearchResultCtaAlerts.pageViews'
const CTA_ALERT_DISPLAY_CADENCE = 5

export const StreamingSearchResults: React.FunctionComponent<StreamingSearchResultsProps> = props => {
    const {
        streamSearch,
        location,
        authenticatedUser,
        telemetryService,
        codeInsightsEnabled,
        isSourcegraphDotCom,
        extensionsController: { extHostAPI: extensionHostAPI },
    } = props

    const enableCodeMonitoring = useExperimentalFeatures(features => features.codeMonitoring ?? false)
    const showSearchContext = useExperimentalFeatures(features => features.showSearchContext ?? false)
    const caseSensitive = useNavbarQueryState(state => state.searchCaseSensitivity)
    const patternType = useNavbarQueryState(state => state.searchPatternType)
    const query = useNavbarQueryState(state => state.searchQueryFromURL)

    const [hasDismissedSignupAlert, setHasDismissedSignupAlert] = useLocalStorage<boolean>(
        'StreamingSearchResults.hasDismissedSignupAlert',
        false
    )
    const [hasDismissedBrowserExtensionAlert, setHasDismissedBrowserExtensionAlert] = useLocalStorage<boolean>(
        'StreamingSearchResults.hasDismissedBrowserExtensionAlert',
        false
    )
    const isBrowserExtensionInstalled = useObservable<boolean>(browserExtensionInstalled)
    const displayCTAsBasedOnCadence = usePersistentCadence(CTA_ALERTS_CADENCE_KEY, CTA_ALERT_DISPLAY_CADENCE)

    const onSignupCtaAlertDismissed = useCallback(() => {
        setHasDismissedSignupAlert(true)
    }, [setHasDismissedSignupAlert])

    const onBrowserExtensionCtaAlertDismissed = useCallback(() => {
        setHasDismissedBrowserExtensionAlert(true)
    }, [setHasDismissedBrowserExtensionAlert])

    // Log view event on first load
    useEffect(
        () => {
            telemetryService.logViewEvent('SearchResults')
        },
        // Only log view on initial load
        // eslint-disable-next-line react-hooks/exhaustive-deps
        []
    )

    // Log search query event when URL changes
    useEffect(() => {
        const metrics = query ? collectMetrics(query) : undefined

        telemetryService.log(
            'SearchResultsQueried',
            {
                code_search: {
                    query_data: {
                        query: metrics,
                        combined: query,
                        empty: !query,
                    },
                },
            },
            {
                code_search: {
                    query_data: {
                        // 🚨 PRIVACY: never provide any private query data in the
                        // { code_search: query_data: query } property,
                        // which is also potentially exported in pings data.
                        query: metrics,

                        // 🚨 PRIVACY: Only collect the full query string for unauthenticated users
                        // on Sourcegraph.com, and only after sanitizing to remove certain filters.
                        combined:
                            !authenticatedUser && isSourcegraphDotCom ? sanitizeQueryForTelemetry(query) : undefined,
                        empty: !query,
                    },
                },
            }
        )
        // Only log when the query changes
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query])

    const trace = useMemo(() => new URLSearchParams(location.search).get('trace') ?? undefined, [location.search])

    const options: StreamSearchOptions = useMemo(
        () => ({
            version: LATEST_VERSION,
            patternType: patternType ?? SearchPatternType.literal,
            caseSensitive,
            trace,
        }),
        [caseSensitive, patternType, trace]
    )

    const results = useCachedSearchResults(streamSearch, query, options, extensionHostAPI, telemetryService)

    // Log events when search completes or fails
    useEffect(() => {
        if (results?.state === 'complete') {
            telemetryService.log('SearchResultsFetched', {
                code_search: {
                    // 🚨 PRIVACY: never provide any private data in { code_search: { results } }.
                    results: {
                        results_count: results.results.length,
                        any_cloning: results.progress.skipped.some(skipped => skipped.reason === 'repository-cloning'),
                        alert: results.alert ? results.alert.title : null,
                    },
                },
            })
        } else if (results?.state === 'error') {
            telemetryService.log('SearchResultsFetchFailed', {
                code_search: { error_message: asError(results.error).message },
            })
            console.error(results.error)
        }
    }, [results, telemetryService])

    useSearchStack(
        useMemo(
            () =>
                results?.state === 'complete'
                    ? {
                          type: 'search',
                          query,
                          caseSensitive,
                          patternType,
                          searchContext: props.selectedSearchContextSpec,
                      }
                    : null,
            [results, query, patternType, caseSensitive, props.selectedSearchContextSpec]
        )
    )

    const [allExpanded, setAllExpanded] = useState(false)
    const onExpandAllResultsToggle = useCallback(() => {
        setAllExpanded(oldValue => !oldValue)
        telemetryService.log(allExpanded ? 'allResultsExpanded' : 'allResultsCollapsed')
    }, [allExpanded, telemetryService])

    const [showSavedSearchModal, setShowSavedSearchModal] = useState(false)
    const onSaveQueryClick = useCallback(() => setShowSavedSearchModal(true), [])
    const onSaveQueryModalClose = useCallback(() => {
        setShowSavedSearchModal(false)
        telemetryService.log('SavedQueriesToggleCreating', { queries: { creating: false } })
    }, [telemetryService])

    // Reset expanded state when new search is started
    useEffect(() => {
        setAllExpanded(false)
    }, [location.search])

    const onSearchAgain = useCallback(
        (additionalFilters: string[]) => {
            telemetryService.log('SearchSkippedResultsAgainClicked')
            submitSearch({
                ...props,
                caseSensitive,
                patternType,
                query: applyAdditionalFilters(query, additionalFilters),
                source: 'excludedResults',
            })
        },
        [query, telemetryService, patternType, caseSensitive, props]
    )
    const [showSidebar, setShowSidebar] = useState(false)

    const onSignUpClick = (): void => {
        telemetryService.log('SignUpPLGSearchCTA_1_Search')
    }

    const resultsFound = useMemo(() => (results ? results.results.length > 0 : false), [results])
    const showSignUpCta = useMemo(
        () => !hasDismissedSignupAlert && !authenticatedUser && displayCTAsBasedOnCadence && resultsFound,
        [authenticatedUser, displayCTAsBasedOnCadence, hasDismissedSignupAlert, resultsFound]
    )
    const showBrowserExtensionCta = useMemo(
        () =>
            !hasDismissedBrowserExtensionAlert &&
            authenticatedUser &&
            isBrowserExtensionInstalled === false &&
            displayCTAsBasedOnCadence &&
            resultsFound,
        [
            authenticatedUser,
            displayCTAsBasedOnCadence,
            hasDismissedBrowserExtensionAlert,
            isBrowserExtensionInstalled,
            resultsFound,
        ]
    )

    // Log view event when signup CTA is shown
    useEffect(() => {
        if (showSignUpCta) {
            telemetryService.log('SearchResultResultsCTAShown')
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showSignUpCta])

    return (
        <div className={styles.streamingSearchResults}>
            <PageTitle key="page-title" title={query} />

            <SearchSidebar
                activation={props.activation}
                caseSensitive={caseSensitive}
                patternType={patternType}
                settingsCascade={props.settingsCascade}
                telemetryService={props.telemetryService}
                selectedSearchContextSpec={props.selectedSearchContextSpec}
                className={classNames(
                    styles.streamingSearchResultsSidebar,
                    showSidebar && styles.streamingSearchResultsSidebarShow
                )}
                filters={results?.filters}
                getRevisions={getRevisions}
                prefixContent={
                    props.isSourcegraphDotCom &&
                    !props.authenticatedUser &&
                    props.featureFlags.get('getting-started-tour') ? (
                        <OnboardingTour className="mb-1" telemetryService={props.telemetryService} />
                    ) : undefined
                }
                buildSearchURLQueryFromQueryState={buildSearchURLQueryFromQueryState}
            />

            <SearchResultsInfoBar
                {...props}
                patternType={patternType}
                caseSensitive={caseSensitive}
                query={query}
                enableCodeInsights={codeInsightsEnabled && isCodeInsightsEnabled(props.settingsCascade)}
                enableCodeMonitoring={enableCodeMonitoring}
                resultsFound={resultsFound}
                className={classNames('flex-grow-1', styles.streamingSearchResultsInfobar)}
                allExpanded={allExpanded}
                onExpandAllResultsToggle={onExpandAllResultsToggle}
                onSaveQueryClick={onSaveQueryClick}
                onShowFiltersChanged={show => setShowSidebar(show)}
                stats={
                    <StreamingProgress
                        progress={results?.progress || { durationMs: 0, matchCount: 0, skipped: [] }}
                        state={results?.state || 'loading'}
                        onSearchAgain={onSearchAgain}
                        showTrace={!!trace}
                    />
                }
            />

            <DidYouMean
                telemetryService={props.telemetryService}
                query={query}
                patternType={patternType}
                caseSensitive={caseSensitive}
                selectedSearchContextSpec={props.selectedSearchContextSpec}
            />

            <div className={styles.streamingSearchResultsContainer}>
                {showSavedSearchModal && (
                    <SavedSearchModal
                        {...props}
                        patternType={patternType}
                        query={query}
                        authenticatedUser={authenticatedUser}
                        onDidCancel={onSaveQueryModalClose}
                    />
                )}

                {results?.alert && (
                    <div className={classNames(styles.streamingSearchResultsContentCentered, 'mt-4')}>
                        <SearchAlert alert={results.alert} caseSensitive={caseSensitive} patternType={patternType} />
                    </div>
                )}

                {showSignUpCta && (
                    <CtaAlert
                        title="Sign up to add your public and private repositories and unlock search flow"
                        description="Do all the things editors can’t: search multiple repos & commit history, monitor, save
                searches and more."
                        cta={{
                            label: 'Create a free account',
                            href: `/sign-up?src=SearchCTA&returnTo=${encodeURIComponent(
                                '/user/settings/repositories'
                            )}`,
                            onClick: onSignUpClick,
                        }}
                        icon={<SearchBetaIcon />}
                        className="mr-3"
                        onClose={onSignupCtaAlertDismissed}
                    />
                )}

                {showBrowserExtensionCta && (
                    <BrowserExtensionAlert className="mr-3" onAlertDismissed={onBrowserExtensionCtaAlertDismissed} />
                )}

                <StreamingSearchResultsList
                    {...props}
                    results={results}
                    allExpanded={allExpanded}
                    showSearchContext={showSearchContext}
                    assetsRoot={window.context?.assetsRoot || ''}
                    renderSearchUserNeedsCodeHost={user => (
                        <SearchUserNeedsCodeHost user={user} orgSearchContext={props.selectedSearchContextSpec} />
                    )}
                />
            </div>
        </div>
    )
}

const applyAdditionalFilters = (query: string, additionalFilters: string[]): string => {
    let newQuery = query
    for (const filter of additionalFilters) {
        const fieldValue = filter.split(':', 2)
        newQuery = updateFilters(newQuery, fieldValue[0], fieldValue[1])
    }
    return newQuery
}
