const CODE_SEARCH = 'Code search use cases'
const CODE_INTEL = 'The power of code intel'
const TOOLS = 'Tools to improve workflow'

export interface OnboardingTourStepItem {
    id: string
    /**
     * Title of the group which step belongs
     */
    group: string
    /**
     * Title/name of the step
     */
    title: string
    /**
     * URL to redirect
     */
    to: string
    /**
     * Flag whether this step was completed of not
     */
    isCompleted: boolean
    /**
     * HTML text to show on page after redirecting to link
     */
    info?: string
    /**
     * Log "${id}Completed" event and mark item as completed after one of the events is triggered
     */
    completeAfterEvents?: string[]
}

export const ONBOARDING_STEP_ITEMS: Omit<OnboardingTourStepItem, 'isCompleted'>[] = [
    // Group: CODE_SEARCH
    {
        id: 'TourSymbolsSearch',
        title: 'Search multiple repos',
        group: CODE_SEARCH,
        to: '/search?q=context:global+repo:linkedin+lang:java+AtomicBoolean&patternType=literal',
        info: `<strong>Reference code in multiple repositories</strong><br/>
            The repo: query allows searching in multiple repositories matching a term. Use it to reference all of your projects or find open source examples.`,
    },
    {
        id: 'TourCommitsSearch',
        title: 'Find changes in commits',
        group: CODE_SEARCH,
        to:
            '/search?q=context:global+repo:%5Egitlab%5C.com/sourcegraph/sourcegraph%24+type:commit+bump&patternType=literal',
        info: `<strong>Find changes in commits</strong><br/>
            Quickly find commits in history, then browse code from the commit, without checking out the branch.`,
    },
    {
        id: 'TourDiffSearch',
        title: 'Search diffs for added code',
        group: CODE_SEARCH,
        to:
            '/search?q=context:global+repo:sourcegraph-testing/+lang:java+type:diff+select:commit.diff.added+//TODO&patternType=literal',
        info: `<strong>Searching diffs for added code</strong><br/>
            Find altered code without browsing through history or trying to remember which file it was in.`,
    },
    // Group: CODE_INTEL
    {
        id: 'TourFindReferences',
        title: 'Find references',
        group: CODE_INTEL,
        info: `<strong>FIND REFERENCES</strong><br/>
            Hover over a token in the highlighted line to open code intel, then click ‘Find References’ to locate all calls of this code.`,
        completeAfterEvents: ['findReferences'],
        to: '/github.com/sourcegraph/sourcegraph/-/blob/internal/featureflag/featureflag.go?L9:6',
    },
    {
        id: 'TourGoToDefinition',
        title: 'Go to a definition',
        group: CODE_INTEL,
        info: `<strong>GO TO DEFINITION</strong><br/>
            Hover over a token in the highlighted line to open code intel, then click ‘Go to definition’ to locate a token definition.`,
        completeAfterEvents: ['goToDefinition', 'goToDefinition.preloaded'],
        to: '/github.com/sourcegraph/sourcegraph/-/blob/internal/repos/observability.go?L192:22',
    },
    // Group: TOOLS
    {
        id: 'TourEditorExtensions',
        group: TOOLS,
        title: 'IDE extensions',
        to: 'https://docs.sourcegraph.com/integration/editor',
    },
    {
        id: 'TourBrowserExtensions',
        group: TOOLS,
        title: 'Browser extensions',
        to: 'https://docs.sourcegraph.com/integration/browser_extension',
    },
]
