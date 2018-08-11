import { combineLatest, from, Observable } from 'rxjs'
import { map, switchMap } from 'rxjs/operators'
import { Hover } from 'vscode-languageserver-types'
import { TextDocumentPositionParams, TextDocumentRegistrationOptions } from '../../protocol'
import { HoverMerged } from '../../types/hover'
import { FeatureProviderRegistry } from './registry'

export type ProvideTextDocumentHoverSignature = (params: TextDocumentPositionParams) => Promise<Hover | null>

/** Provides hovers from all extensions. */
export class TextDocumentHoverProviderRegistry extends FeatureProviderRegistry<
    TextDocumentRegistrationOptions,
    ProvideTextDocumentHoverSignature
> {
    public getHover(params: TextDocumentPositionParams): Observable<HoverMerged | null> {
        return getHover(this.providers, params)
    }
}

/**
 * Returns an observable that emits all providers' hovers whenever any of the last-emitted set of providers emits
 * hovers.
 *
 * Most callers should use TextDocumentHoverProviderRegistry's getHover method, which uses the registered hover
 * providers.
 */
export function getHover(
    providers: Observable<ProvideTextDocumentHoverSignature[]>,
    params: TextDocumentPositionParams
): Observable<HoverMerged | null> {
    return providers
        .pipe(
            switchMap(providers => {
                if (providers.length === 0) {
                    return [[null]]
                }
                return combineLatest(providers.map(provider => from(provider(params))))
            })
        )
        .pipe(map(HoverMerged.from))
}
