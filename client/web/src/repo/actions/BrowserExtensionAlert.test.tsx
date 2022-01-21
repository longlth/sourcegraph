import { render } from '@testing-library/react'
import React from 'react'

import { BrowserExtensionAlert } from './BrowserExtensionAlert'

describe('BrowserExtensionAlert', () => {
    it('matches snapshot', () => {
        expect(
            render(<BrowserExtensionAlert className="" onAlertDismissed={() => {}} />).asFragment()
        ).toMatchSnapshot()
    })
})
