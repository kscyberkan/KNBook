
import { ArrowLeft, ArrowRight } from 'lucide-react';
import React from 'react'

type ButtonProps = {
    id?: string;
    label?: string;
    onClick?: React.MouseEventHandler<HTMLButtonElement> | undefined;
}

function Button_Default(props: ButtonProps) {
    return (
        <button id={props.id} type="button" onClick={props.onClick} className="mt-6 w-full rounded-xl bg-[var(--primary)] py-3 font-semibold text-white transition active:scale-95 hover:opacity-90 hover:cursor-pointer">
            {props.label}
        </button>
    )
}

// วางยา
function Button_Back(props: ButtonProps) {
    return (
        <button
            id={props.id} type="button" onClick={props.onClick}
            className="
                        hidden sm:flex
                        fixed top-5 left-5 z-50
                        items-center gap-2
                        rounded-xl
                        bg-[var(--card)]/80 backdrop-blur
                        border border-[var(--border)]
                        px-4 py-2
                        text-sm text-[var(--text)]
                        shadow
                        hover:bg-[var(--hover)]
                        transition
                        hover:cursor-pointer
                    "
        >
            <ArrowLeft size={18} className="text-[var(--primary)]" />
            {props.label}
        </button>
    )
}

// วางยา
function Button_Next(props: ButtonProps) {
    return (
        <button
            id={props.id} type="button" onClick={props.onClick}
            className="
                        hidden sm:flex
                        fixed top-5 left-5 z-50
                        items-center gap-2
                        rounded-xl
                        bg-[var(--card)]/80 backdrop-blur
                        border border-[var(--border)]
                        px-4 py-2
                        text-sm text-[var(--text)]
                        shadow
                        hover:bg-[var(--hover)]
                        transition
                        hover:cursor-pointer
                    "
        >
            {props.label}
            <ArrowRight size={18} className="text-[var(--primary)]" />
        </button>
    )
}

const Button = {
    "Default": Button_Default,
    "Back": Button_Back,
    "Next": Button_Next
}

export default Button
