import localtunnel from 'localtunnel';

export interface Tunnel {
  url: string;
  close: () => Promise<void>;
}

export async function createTunnel(port: number): Promise<Tunnel> {
  const tunnel = await localtunnel({ port });

  return {
    url: tunnel.url,
    close: () =>
      new Promise<void>((resolve) => {
        tunnel.close();
        resolve();
      }),
  };
}
