const LOTTIE_FILE = /\.(?:json|lottie)$/i;

export const isLottieFile = (file: { name: string }): boolean => LOTTIE_FILE.test(file.name);
