import { NotificationType } from 'sourcegraph'

import { HoverOverlayProps as GenericHoverOverlayProps } from '@sourcegraph/codeintellify'
import { FileSpec, RepoSpec, ResolvedRevisionSpec, RevisionSpec } from '@sourcegraph/common/src/util/url'

import { ActionItemAction } from '../actions/ActionItem'
import { HoverMerged } from '../api/client/types/hover'

export type HoverContext = RepoSpec & RevisionSpec & FileSpec & ResolvedRevisionSpec

export interface HoverOverlayBaseProps extends GenericHoverOverlayProps<HoverContext, HoverMerged, ActionItemAction> {}

export type GetAlertClassName = (
    kind: Exclude<NotificationType, NotificationType.Log | NotificationType.Success>
) => string | undefined
