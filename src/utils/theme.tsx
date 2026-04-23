import { createContext, useContext, useEffect, useState } from "react";

// 🎨 Theme types
export type Theme = "pink" | "blue" | "green" | "dark" | "light";

// 🎯 Context
const ThemeContext = createContext<{
    theme: Theme;
    setTheme: (t: Theme) => void;
}>({ theme: "pink", setTheme: () => { } });

// 🌍 Provider (wrap App)
export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setTheme] = useState<Theme>(() => {
        return (localStorage.getItem("theme") as Theme) || "pink";
    });

    useEffect(() => {
        document.documentElement.className = theme;
        localStorage.setItem("theme", theme);
    }, [theme]);

    return (
        <ThemeContext.Provider value={{ theme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

// 🪝 Hook
export const useTheme = () => useContext(ThemeContext);

/* =========================
   🌈 Tailwind theme classes
   =========================
   add in index.css

:root.pink { --primary: #f43f5e; }
:root.blue { --primary: #3b82f6; }
:root.green { --primary: #22c55e; }
:root.dark { --primary: #111827; }
:root.light { --primary: #ffffff; }

.bg-primary { background-color: var(--primary); }
.text-primary { color: var(--primary); }
*/

/* =========================
   ⚙️ Theme selector (Settings)
   ========================= */

export function ThemeSelector() {
    const { theme, setTheme } = useTheme();

    const themes: Theme[] = ["pink", "blue", "green", "dark", "light"];

    return (
        <div className="space-y-2">
            <p className="text-sm font-medium">เลือกธีม</p>
            <div className="flex gap-2">
                {themes.map((t) => (
                    <button
                        key={t}
                        onClick={() => setTheme(t)}
                        className={`px-3 py-1 rounded-lg border text-sm capitalize ${theme === t ? "bg-primary text-white" : "bg-white"
                            }`}
                    >
                        {t}
                    </button>
                ))}
            </div>
        </div>
    );
}
