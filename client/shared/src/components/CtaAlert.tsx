import classNames from 'classnames'
import CloseIcon from 'mdi-react/CloseIcon'
import React from 'react'

import { Button } from '@sourcegraph/wildcard'

import styles from './CtaAlert.module.scss'
import { Link } from './Link'

export interface CtaAlertProps {
    title: string
    description: string | React.ReactNode
    cta: {
        label: string
        href: string
        onClick?: () => void
    }
    icon: React.ReactNode
    onClose: () => void
}

export const CtaAlert: React.FunctionComponent<CtaAlertProps> = props => (
    <div className="card my-2 mr-3 d-flex p-3 pr-5 flex-md-row flex-column align-items-center">
        <div className="mr-md-3">{props.icon}</div>
        <div className="flex-1 my-md-0 my-2">
            <div className={classNames('mb-1', styles.ctaTitle)}>
                <strong>{props.title}</strong>
            </div>
            <div className={classNames('text-muted', 'mb-2', styles.ctaDescription)}>{props.description}</div>
            <Button to={props.cta.href} onClick={props.cta.onClick} variant="primary" as={Link}>
                {props.cta.label}
            </Button>
        </div>
        <CloseIcon
            className="icon-inline position-absolute cursor-pointer"
            style={{ top: '1rem', right: '1rem' }}
            onClick={props.onClose}
        />
    </div>
)
