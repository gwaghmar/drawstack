import React, { FormEvent } from "react";
import { useTheme } from "./ThemeProvider";

const cn = (...args: (string | false | undefined | null)[]) => args.filter(Boolean).join(" ");


interface FormProps extends React.HTMLAttributes<HTMLFormElement> {
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  children: React.ReactNode;
}

export function Form({ onSubmit, children, className, ...props }: FormProps) {
  const { theme } = useTheme();
  
  const handleFormSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit(e);
  };

  const themeClasses = {
    editorial: "space-y-6",
    brutalist: "space-y-4 border-2 border-black p-4 bg-white shadow-[4px_4px_0_0_rgba(0,0,0,1)]",
    retro: "space-y-4 font-mono",
    wireframe: "space-y-4",
    glass: "space-y-6",
  };

  return (
    <form 
      onSubmit={handleFormSubmit}
      className={["w-full flex flex-col", themeClasses[theme], className].filter(Boolean).join(" ")}
      {...props}
    >
      {children}
    </form>
  );
}
