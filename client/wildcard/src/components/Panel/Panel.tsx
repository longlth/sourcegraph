import classNames from 'classnames'
import { upperFirst } from 'lodash'
import React, { useRef } from 'react'

import { PANEL_POSITIONS } from './constants'
import styles from './Panel.module.scss'
import { useResizablePanel } from './useResizablePanel'

export interface PanelProps {
    isFloating?: boolean
    className?: string
    handleClassName?: string
    storageKey?: string
    defaultSize?: number
    position?: typeof PANEL_POSITIONS[number]
}

export const Panel: React.FunctionComponent<PanelProps> = ({
    children,
    isFloating = true,
    className,
    handleClassName,
    defaultSize = 200,
    storageKey,
    position = 'bottom',
}) => {
    const handleReference = useRef<HTMLDivElement | null>(null)
    const panelReference = useRef<HTMLDivElement | null>(null)

    const { panelSize, isResizing } = useResizablePanel({
        position,
        panelRef: panelReference,
        handleRef: handleReference,
        storageKey,
        defaultSize,
    })

    return (
        <div>
            <div
                // eslint-disable-next-line react/forbid-dom-props
                style={{
                    [position === 'bottom' ? 'height' : 'width']: `${panelSize}px`,
                    paddingRight: isFloating ? 0 : '0.5rem',
                }}
                className={classNames(
                    className,
                    styles.panel,
                    styles[`panel${upperFirst(position)}` as keyof typeof styles]
                )}
                ref={panelReference}
            >
                {children}
                <div
                    ref={handleReference}
                    className={classNames(
                        styles.handle,
                        handleClassName || styles[`handle${upperFirst(position)}` as keyof typeof styles],
                        isResizing && styles.handleResizing
                    )}
                />
            </div>
            {!isFloating && (
                <div
                    // eslint-disable-next-line react/forbid-dom-props
                    style={{
                        [position === 'bottom' ? 'height' : 'width']: `${panelSize}px`,
                        marginRight: '0.5rem',
                    }}
                />
            )}
        </div>
    )
}
