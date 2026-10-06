declare module 'localtunnel' {
  interface LocalTunnel {
    url: string;
    close(): void;
  }

  interface LocalTunnelOptions {
    port: number;
  }

  export default function localtunnel(options: LocalTunnelOptions): Promise<LocalTunnel>;
}
