import React from 'react';
import classNames from 'classnames';
import styles from '@sourcegraph/web/src/search/results/StreamingSearchResults.module.scss';
import {Link} from './Link';
import CloseIcon from 'mdi-react/CloseIcon';


export interface CtaAlertProps {
    title: string;
    description: string;
    cta: {
        label: string;
        href: string;
        onClick?: () => void;
    },
    icon: React.ReactElement<any>;
    onClose: () => void;
}

export const CtaAlert: React.FunctionComponent<CtaAlertProps> = props => {
    return <div className="card my-2 mr-3 d-flex p-3 pr-5 flex-md-row flex-column align-items-center">
        <div className="mr-md-3">
            {props.icon}
        </div>
        <div className="flex-1 my-md-0 my-2">
            <div className={classNames('mb-1', styles.streamingSearchResultsCtaTitle)}>
                <strong>
                    {props.title}
                </strong>
            </div>
            <div className={classNames('text-muted', 'mb-2', styles.streamingSearchResultsCtaDescription)}>
                {props.description}
            </div>
            <Link className="btn btn-primary" to={props.cta.href} onClick={props.cta.onClick}>
                {props.cta.label}
            </Link>
        </div>
        <CloseIcon className="icon-inline position-absolute cursor-pointer" style={{top: '1rem', right: '1rem'}} onClick={props.onClose} />
    </div>;
};
