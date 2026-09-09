import React from 'react';

export function Bad({ html }: { html: string }) {
    // ruleid: f1v-no-dangerously-set-inner-html
    return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

export function Good({ text }: { text: string }) {
    // ok: f1v-no-dangerously-set-inner-html
    return <div>{text}</div>;
}

export function UnsafeLink() {
    // ruleid: f1v-no-target-blank-without-noopener
    return <a href="https://openf1.org" target="_blank">OpenF1</a>;
}

export function SafeLink() {
    // ok: f1v-no-target-blank-without-noopener
    return <a href="https://openf1.org" target="_blank" rel="noopener noreferrer">OpenF1</a>;
}
