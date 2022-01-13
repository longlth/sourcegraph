import React, { useCallback, useMemo } from 'react'

import { useLocalStorage } from '@sourcegraph/shared/src/util/useLocalStorage'
import { useObservable } from '@sourcegraph/shared/src/util/useObservable'

import { browserExtensionInstalled } from '../../tracking/analyticsUtils'
import { HOVER_COUNT_KEY, HOVER_THRESHOLD } from '../RepoContainer'

import { BrowserExtensionAlert } from './BrowserExtensionAlert'
import { NativeIntegrationAlert, NativeIntegrationAlertProps } from './NativeIntegrationAlert'

export interface ExtensionAlertProps {
    onExtensionAlertDismissed: () => void
}

interface InstallIntegrationsAlertProps extends Pick<NativeIntegrationAlertProps, 'externalURLs'>, ExtensionAlertProps {
    codeHostIntegrationMessaging: 'native-integration' | 'browser-extension'
}

const HAS_DISMISSED_ALERT_KEY = 'has-dismissed-extension-alert'

export const InstallIntegrationsAlert: React.FunctionComponent<InstallIntegrationsAlertProps> = ({
    codeHostIntegrationMessaging,
    externalURLs,
    onExtensionAlertDismissed,
}) => {
    const isBrowserExtensionInstalled = useObservable(browserExtensionInstalled)
    const [hoverCount] = useLocalStorage(HOVER_COUNT_KEY, 0)
    const [hasDismissedExtensionAlert, setHasDismissedExtensionAlert] = useLocalStorage(HAS_DISMISSED_ALERT_KEY, false)
    const showExtensionAlert = useMemo(
        () => isBrowserExtensionInstalled === false && !hasDismissedExtensionAlert && hoverCount >= HOVER_THRESHOLD,
        // Intentionally use useMemo() here without a dependency on hoverCount to only show the alert on the next reload,
        // to not cause an annoying layout shift from displaying the alert.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [hasDismissedExtensionAlert, isBrowserExtensionInstalled]
    )

    const onAlertDismissed = useCallback(() => {
        onExtensionAlertDismissed()
        setHasDismissedExtensionAlert(true)
    }, [onExtensionAlertDismissed, setHasDismissedExtensionAlert])

    if (!showExtensionAlert) {
        return null
    }

    if (codeHostIntegrationMessaging === 'native-integration') {
        return <NativeIntegrationAlert onAlertDismissed={onAlertDismissed} externalURLs={externalURLs} />
    }

    return <BrowserExtensionAlert onAlertDismissed={onAlertDismissed} />
}
