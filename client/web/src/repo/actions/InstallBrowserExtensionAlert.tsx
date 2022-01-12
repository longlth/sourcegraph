import React from 'react';

import { AlertLink } from '@sourcegraph/wildcard'

import { ExternalLinkFields, ExternalServiceKind } from '../../graphql-operations'
import { eventLogger } from '../../tracking/eventLogger'

import { serviceKindDisplayNameAndIcon } from './GoToCodeHostAction'
import {CtaAlert} from '@sourcegraph/shared/src/components/CtaAlert';
import {SearchBetaIcon} from '../../search/CtaIcons';

interface Props {
    onAlertDismissed: () => void
    externalURLs: ExternalLinkFields[]
    browserName?: 'chrome' | 'firefox' | 'other'
    codeHostIntegrationMessaging: 'browser-extension' | 'native-integration'
}

// TODO(tj): Add Firefox once the Firefox extension is back
const CHROME_EXTENSION_STORE_LINK = 'https://chrome.google.com/webstore/detail/dgjhfomjieaadpoljlnidmbgkdffpack'

/** Code hosts the browser extension supports */
const supportedServiceTypes = new Set<string>([
    ExternalServiceKind.GITHUB,
    ExternalServiceKind.GITLAB,
    ExternalServiceKind.PHABRICATOR,
    ExternalServiceKind.BITBUCKETSERVER,
])

export const InstallBrowserExtensionAlert: React.FunctionComponent<Props> = ({
    onAlertDismissed,
    externalURLs,
    browserName,
    codeHostIntegrationMessaging,
}) => {
    const externalLink = externalURLs.find(link => link.serviceKind && supportedServiceTypes.has(link.serviceKind))
    if (!externalLink) {
        return null
    }

    const { serviceKind } = externalLink
    const { displayName } = serviceKindDisplayNameAndIcon(serviceKind)

    if (codeHostIntegrationMessaging === 'native-integration') {
        return     <CtaAlert title={`Your site admin set up the Sourcegraph native integration for ${displayName}.`}
            description={<>
                Sourcegraph's code intelligence will follow you to your code host.{' '}
                <AlertLink
                    to="https://docs.sourcegraph.com/integration/browser_extension?utm_campaign=inproduct-cta&utm_medium=direct_traffic&utm_source=search-results-cta&utm_term=null&utm_content=install-browser-exten"
                    target="_blank"
                    rel="noopener"
                >Learn more</AlertLink></>}
            cta={{label: 'Try it out',
                href: externalLink.url,
                onClick: createInstallLinkClickHandler('NativeIntegrationBrowserExtensionInstallClicked')}}
            icon={<SearchBetaIcon />}
            onClose={onAlertDismissed} />
    }

    if (browserName === 'firefox') {
        return     <CtaAlert title="Install ...."
            description={<>If you already have the local version, <a
                href="https://docs.sourcegraph.com/integration/migrating_firefox_extension?utm_campaign=inproduct-cta&utm_medium=direct_traffic&utm_source=search-results-cta&utm_term=null&utm_content=install-browser-exten"
                target="_blank"
                rel="noopener noreferrer"
                onClick={createInstallLinkClickHandler('FirefoxBrowserExtensionInstallClicked')}
            >make sure to upgrade</a>.<br />The extension adds code intelligence to code views on {displayName} or any other connected code host.</>}
            cta={{label: 'Install the Sourcegraph browser extension',
                href: 'https://addons.mozilla.org/en-US/firefox/addon/sourcegraph-for-firefox?utm_campaign=inproduct-cta&utm_medium=direct_traffic&utm_source=search-results-cta&utm_term=null&utm_content=install-browser-exten',
                onClick: createInstallLinkClickHandler('FirefoxBrowserExtensionInstallClicked')}}
            icon={<SearchBetaIcon />}
            onClose={onAlertDismissed} />
    }

    if (browserName === 'chrome') {
        return     <CtaAlert title="Install the Sourcegraph browser extension"
            description={<>
                Add code intelligence{' '}
                {serviceKind === ExternalServiceKind.GITHUB ||
                serviceKind === ExternalServiceKind.BITBUCKETSERVER ||
                serviceKind === ExternalServiceKind.GITLAB ? (
                    <>
                        to {serviceKind === ExternalServiceKind.GITLAB ? 'merge requests' : 'pull requests'}{' '}
                        and file views
                    </>
                ) : (
                    <>while browsing and reviewing code</>
                )}{' '}
                on {displayName}.
            </>}
            cta={{label: 'Install the Sourcegraph browser extension',
                href: CHROME_EXTENSION_STORE_LINK,
                onClick: createInstallLinkClickHandler('ChromeBrowserExtensionInstallClicked')}}
            icon={<SearchBetaIcon />}
            onClose={onAlertDismissed} />
    }

    return <CtaAlert title="Install the Sourcegraph browser extension"
        description={<>Get code intelligence{' '}
            {serviceKind === ExternalServiceKind.GITHUB ||
            serviceKind === ExternalServiceKind.BITBUCKETSERVER ||
            serviceKind === ExternalServiceKind.GITLAB ? (
                <>
                    while browsing files and reviewing{' '}
                    {serviceKind === ExternalServiceKind.GITLAB ? 'merge requests' : 'pull requests'}
                </>
            ) : (
                <>while browsing and reviewing code</>
            )}{' '}
            on {displayName}.</>}
        cta={{label: 'Learn more about Sourcegraph Chrome and Firefox extensions',
            href: '/help/integration/browser_extension',
            onClick: createInstallLinkClickHandler('OtherBrowserExtensionInstallClicked')}}
        icon={<SearchBetaIcon />}
        onClose={onAlertDismissed} />;
}

const FIREFOX_ALERT_START_DATE = new Date('July 16, 2021')
export const FIREFOX_ALERT_FINAL_DATE = new Date('October 18, 2021')

export function isFirefoxCampaignActive(currentMs: number): boolean {
    return currentMs < FIREFOX_ALERT_FINAL_DATE.getTime() && currentMs > FIREFOX_ALERT_START_DATE.getTime()
}

const createInstallLinkClickHandler = (eventName:string) =>  (): void => {
    eventLogger.log(eventName)
}
