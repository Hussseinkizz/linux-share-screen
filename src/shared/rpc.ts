export type Mode = "lan" | "internet";
export type Status = "idle" | "starting" | "sharing" | "error";

export interface ShareState {
	status: Status;
	mode: Mode;
	link: string | null;
	error: string | null;
	logs: string[];
	lanIp: string | null;
	audio: boolean;
	namedTunnel: string | null;
	version: string;
}

export type RPCSchema<T extends { requests: Record<string, unknown>; messages: Record<string, unknown> }> = {
	requests: {
		[K in keyof T["requests"]]: T["requests"][K] extends { params: infer P; response: infer R }
			? { params: P; response: R }
			: never;
	};
	messages: {
		[K in keyof T["messages"]]: T["messages"][K];
	};
};

export type AppRPC = {
	bun: RPCSchema<{
		requests: {
			getState: { params: {}; response: ShareState };
			start: { params: { mode: Mode }; response: ShareState };
			stop: { params: {}; response: ShareState };
			rotateToken: { params: {}; response: ShareState };
			setAudio: { params: { enabled: boolean }; response: ShareState };
			setTunnel: { params: { token: string; hostname: string }; response: ShareState };
			getPreview: { params: {}; response: { data: string | null; error?: string } };
			openExternal: { params: { url: string }; response: boolean };
			copyText: { params: { text: string }; response: boolean };
		};
		messages: {};
	}>;
	webview: RPCSchema<{
		requests: {};
		messages: {
			stateChanged: ShareState;
		};
	}>;
};
