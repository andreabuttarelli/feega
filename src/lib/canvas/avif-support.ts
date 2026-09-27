let cached: Promise<boolean> | null = null;

export function avifEncodable(): Promise<boolean> {
	if (!cached) {
		cached = detect();
	}
	return cached;
}

function detect(): Promise<boolean> {
	if (typeof document === 'undefined') {
		return Promise.resolve(false);
	}

	const canvas = document.createElement('canvas');
	canvas.width = 1;
	canvas.height = 1;

	return new Promise((resolve) => {
		canvas.toBlob(
			(blob) => resolve(!!blob && blob.type === 'image/avif'),
			'image/avif'
		);
	});
}
