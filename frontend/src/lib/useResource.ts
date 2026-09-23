"use client";
import { useEffect, useState } from "react";

export function useResource<T>(loader: () => Promise<T>) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{
    loader: () => Promise<T>;
    revision: number;
    data: T | null;
    error: string | null;
  }>({ loader, revision, data: null, error: null });

  useEffect(() => {
    let active = true;
    loader().then(
      (data) => {
        if (active) setState({ loader, revision, data, error: null });
      },
      (error) => {
        if (active)
          setState({
            loader,
            revision,
            data: null,
            error:
              error instanceof Error
                ? error.message
                : "Não foi possível carregar.",
          });
      },
    );
    return () => {
      active = false;
    };
  }, [loader, revision]);

  // Never show results for a previous search or language while the new one loads.
  const current = state.loader === loader && state.revision === revision;
  function reload() {
    setRevision((value) => value + 1);
  }
  function setData(data: T) {
    setState({ loader, revision, data, error: null });
  }
  return {
    data: current ? state.data : null,
    error: current ? state.error : null,
    reload,
    setData,
  };
}
