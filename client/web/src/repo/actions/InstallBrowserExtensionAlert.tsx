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
    codeHostIntegrationMessaging: 'browser-extension' | 'native-integration'
}

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
                onClick: createInstallLinkClickHandler('NativeIntegrationInstallClicked')}}
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
        cta={{label: 'Learn more about the extension',
            href: 'https://docs.sourcegraph.com/integration/browser_extension?utm_campaign=inproduct-cta&utm_medium=direct_traffic&utm_source=search-results-cta&utm_term=null&utm_content=install-browser-exten',
            onClick: createInstallLinkClickHandler('BrowserExtensionInstallClicked')}}
        icon={<SearchBetaIcon />}
        onClose={onAlertDismissed} />;
}

const createInstallLinkClickHandler = (eventName:string) =>  (): void => {
    eventLogger.log(eventName)
}
