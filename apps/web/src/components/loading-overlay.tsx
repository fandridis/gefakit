import * as React from 'react';
import { cn } from '@/lib/utils';

export const LoadingOverlay = ({ loading, children, className }: { loading: boolean, children: React.ReactNode, className?: string }) => {
    return (
        <div className={cn("relative inline-block", className)}>
            <div className={cn(loading && 'blur-[1px]')}>
                {React.Children.map(children, child =>
                    React.isValidElement(child) ?
                        React.cloneElement(child as React.ReactElement<{ className?: string }>, {
                            className: cn(
                                (child as React.ReactElement<{ className?: string }>).props.className,
                                loading && 'opacity-50'
                            )
                        })
                        : child
                )}
            </div>
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <svg className="animate-spin h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-labelledby="loadingTitle">
                        <title id="loadingTitle">Loading</title>
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                </div>
            )}
        </div>
    );
};
