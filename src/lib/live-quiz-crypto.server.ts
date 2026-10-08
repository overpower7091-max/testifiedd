type QuestionForEncryption = {
  id: string;
  position: number;
  difficulty: string;
  text: string;
  options: unknown[];
  images: string[];
};

type EncryptedQuestion = {
  position: number;
  iv: string;
  ciphertext: string;
};

const bundleCache = new Map<string, EncryptedQuestion[]>();
const encoder = new TextEncoder();

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

async function deriveQuestionKey(secret: string, quizId: string, position: number): Promise<Uint8Array> {
  const hmacKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const keyBytes = await crypto.subtle.sign("HMAC", hmacKey, encoder.encode(`${quizId}:${position}`));
  return new Uint8Array(keyBytes);
}

export async function encryptLiveQuizQuestions(
  secret: string,
  quizId: string,
  questions: QuestionForEncryption[],
): Promise<EncryptedQuestion[]> {
  const cached = bundleCache.get(quizId);
  if (cached) return cached;

  const encrypted = await Promise.all(
    questions.map(async (question) => {
      const keyBytes = await deriveQuestionKey(secret, quizId, question.position);
      const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt"]);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const plaintext = encoder.encode(JSON.stringify(question));
      const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
      return {
        position: question.position,
        iv: toBase64(iv),
        ciphertext: toBase64(new Uint8Array(ciphertext)),
      };
    }),
  );

  bundleCache.set(quizId, encrypted);
  if (bundleCache.size > 128) {
    const oldest = bundleCache.keys().next().value;
    if (oldest) bundleCache.delete(oldest);
  }
  return encrypted;
}

export async function getLiveQuizQuestionKey(
  secret: string,
  quizId: string,
  position: number,
): Promise<string> {
  return toBase64(await deriveQuestionKey(secret, quizId, position));
}