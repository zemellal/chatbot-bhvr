// export type ApiResponse<T = unknown> =
// 	| {
// 			success: true;
// 			data: T | null;
// 			message?: string;
// 	  }
// 	| {
// 			success: false;
// 			error: string;
// 	  };

export type ApiResponse = {
	message: string;
	success: true;
	data?: unknown;
};

export type ApiErrorResponse = {
	error: string;
	success: false;
};
