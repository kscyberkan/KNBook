import React from 'react'

type InputFieldProps = {
    id?: string;
    name?: string;
    label?: string;
    placeholder?: string;
    type?: React.HTMLInputTypeAttribute;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
    maxLength?: number;
    inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
    ref?: React.Ref<HTMLInputElement> | undefined;
}

function InputField_Default(props: InputFieldProps) {
    return (
        <div className="relative">
            <input
                id={props.id}
                ref={props.ref}
                type={props.type}
                onChange={props.onChange}
                inputMode={props.inputMode}
                maxLength={props.maxLength}
                name={props.name}
                placeholder=" "
                className="
      peer w-full rounded-xl
      border border-[var(--border)]
      bg-transparent
      px-4 py-3 text-sm
      text-[var(--text)]
      focus:border-[var(--primary)]
      focus:outline-none
    "
            />

            <label
                htmlFor={props.id}
                className="
      pointer-events-none
      absolute left-4 top-1/2 -translate-y-1/2
      text-sm text-[var(--muted)]
      transition-all duration-200

      peer-focus:top-0
      peer-focus:-translate-y-1/2
      peer-focus:text-xs
      peer-focus:text-[var(--primary)]
      peer-focus:bg-[var(--card)]
      peer-focus:px-1

      peer-not-placeholder-shown:top-0
      peer-not-placeholder-shown:-translate-y-1/2
      peer-not-placeholder-shown:text-xs
      peer-not-placeholder-shown:bg-[var(--card)]
      peer-not-placeholder-shown:px-1
    "
            >
                {props.placeholder}
            </label>
        </div>
    )
}

const InputField = {
    "Default": InputField_Default
}

export default InputField
