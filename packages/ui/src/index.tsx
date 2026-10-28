import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';

export function Button({
  children,
  ...props
}: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>>) {
  return (
    <button type="button" {...props}>
      {children}
    </button>
  );
}

export function Placeholder({ label }: { label: string }) {
  return <div data-placeholder={label}>{label}</div>;
}
