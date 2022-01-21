import { render } from '@testing-library/react'
import React from 'react'

import { ExternalServiceKind } from '@sourcegraph/shared/src/schema'

import { NativeIntegrationAlert } from './NativeIntegrationAlert'

describe('NativeIntegrationAlert', () => {
    const serviceKinds = [
        ExternalServiceKind.GITHUB,
        ExternalServiceKind.GITLAB,
        ExternalServiceKind.PHABRICATOR,
        ExternalServiceKind.BITBUCKETSERVER,
        null,
    ] as const
    for (const serviceKind of serviceKinds) {
        it(`matches snapshot for ${serviceKind ?? 'none'}`, () => {
            expect(
                render(
                    <NativeIntegrationAlert
                        className=""
                        onAlertDismissed={() => {}}
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
})
