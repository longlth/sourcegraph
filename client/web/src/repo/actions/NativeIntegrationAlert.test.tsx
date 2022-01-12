import { render } from '@testing-library/react'
import { noop } from 'lodash'
import React from 'react'

import { ExternalServiceKind } from '@sourcegraph/shared/src/graphql/schema'

import { NativeIntegrationAlert } from './NativeIntegrationAlert'

describe('InstallBrowserExtensionAlert', () => {
    const serviceKinds = [
        ExternalServiceKind.GITHUB,
        ExternalServiceKind.GITLAB,
        ExternalServiceKind.PHABRICATOR,
        ExternalServiceKind.BITBUCKETSERVER,
        null,
    ] as const
    const integrationTypes = ['native-integration', 'browser-extension'] as const
    for (const serviceKind of serviceKinds) {
        for (const integrationType of integrationTypes) {
            test(`${serviceKind ?? 'none'} (${integrationType})`, () => {
                expect(
                    render(
                        <NativeIntegrationAlert
                            onAlertDismissed={noop}
                            externalURLs={
                                serviceKind
                                    ? [
                                          {
                                              url: '',
                                              serviceKind,
                                          },
                                      ]
                                    : []
                            }
                        />
                    ).asFragment()
                ).toMatchSnapshot()
            })
        }
    }
})
