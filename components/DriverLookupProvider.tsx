"use client";

import {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from "react";
import type { Driver, Team } from "@/lib/driversData";
import DriverModal from "@/components/DriverModal";

/* ------------------------------------------------------------------ */
/*  Context                                                            */
/* ------------------------------------------------------------------ */

type DriverLookupContextType = {
  /** Look up a driver + team by driver_id. Returns null if not found. */
  getDriver: (driverId: string) => { driver: Driver; team: Team } | null;
  /** Open the Driver Card modal for the given driver_id (no-op if not found). */
  openDriverModal: (driverId: string) => void;
};

const DriverLookupContext = createContext<DriverLookupContextType>({
  getDriver: () => null,
  openDriverModal: () => {},
});

/** Hook to access driver lookup + modal opener from any child component. */
export function useDriverLookup() {
  return useContext(DriverLookupContext);
}

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */

type DriverLookupProviderProps = {
  drivers: Driver[];
  teams: Team[];
  placeholderSrc: string;
  children: React.ReactNode;
};

const PLACEHOLDER_PHOTO = "/placeholders/driver.png";

export default function DriverLookupProvider({
  drivers,
  teams,
  placeholderSrc = PLACEHOLDER_PHOTO,
  children,
}: DriverLookupProviderProps) {
  const [selected, setSelected] = useState<{
    driver: Driver;
    team: Team;
  } | null>(null);

  const lastFocused = useRef<HTMLElement | null>(null);

  /* ---- Build lookup maps (stable across renders) ---- */
  const driverMap = useMemo(
    () => new Map(drivers.map((d) => [d.driver_id, d])),
    [drivers],
  );

  const teamMap = useMemo(
    () => new Map(teams.map((t) => [t.team_key, t])),
    [teams],
  );

  /* ---- Lookup helpers ---- */
  const getDriver = useCallback(
    (driverId: string) => {
      if (!driverId) return null;
      const driver = driverMap.get(driverId);
      if (!driver) return null;
      const team = teamMap.get(driver.team_key) ?? {
        team_key: driver.team_key,
        team_name: "Unknown",
        logo_url: "",
      };
      return { driver, team };
    },
    [driverMap, teamMap],
  );

  const openDriverModal = useCallback(
    (driverId: string) => {
      const result = getDriver(driverId);
      if (result) {
        lastFocused.current = document.activeElement as HTMLElement;
        setSelected(result);
      }
    },
    [getDriver],
  );

  /* ---- Escape to close ---- */
  useEffect(() => {
    if (!selected) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      lastFocused.current?.focus?.();
    };
  }, [selected]);

  /* ---- Context value (stable reference) ---- */
  const value = useMemo(
    () => ({ getDriver, openDriverModal }),
    [getDriver, openDriverModal],
  );

  return (
    <DriverLookupContext.Provider value={value}>
      {children}
      {selected && (
        <DriverModal
          driver={selected.driver}
          team={selected.team}
          placeholderSrc={placeholderSrc}
          onClose={() => setSelected(null)}
        />
      )}
    </DriverLookupContext.Provider>
  );
}
