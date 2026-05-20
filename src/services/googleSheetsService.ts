import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive');
provider.addScope('https://www.googleapis.com/auth/drive.file');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initGoogleAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getGoogleAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const googleLogout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

// Spreadsheet Logic
export const importFromSpreadsheet = async (spreadsheetId: string, range: string): Promise<any> => {
    const accessToken = await getGoogleAccessToken();
    if (!accessToken) {
        throw new Error('Usuário não autenticado no Google');
    }

    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    
    if (!res.ok) {
        throw new Error('Falha ao ler dados da planilha do Google');
    }

    const data = await res.json();
    return data;
};

// Drive Logic
export const listDriveFiles = async (mimeType?: string): Promise<any[]> => {
    const accessToken = await getGoogleAccessToken();
    if (!accessToken) {
        throw new Error('Usuário não autenticado no Google');
    }

    let url = 'https://www.googleapis.com/drive/v3/files?fields=files(id,name,mimeType,modifiedTime,webViewLink)';
    if (mimeType) {
        url += `&q=mimeType='${mimeType}' and trashed=false`;
    }

    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
        throw new Error('Falha ao listar arquivos do Google Drive');
    }

    const data = await res.json();
    return data.files || [];
};

export const downloadDriveFile = async (fileId: string): Promise<Blob> => {
    const accessToken = await getGoogleAccessToken();
    if (!accessToken) {
        throw new Error('Usuário não autenticado no Google');
    }

    // Check file metadata first
    const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=mimeType`, {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    if (!metaRes.ok) {
        throw new Error('Falha ao verificar metadata do arquivo no Google Drive');
    }
    
    const meta = await metaRes.json();
    let downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    
    if (meta.mimeType === 'application/vnd.google-apps.spreadsheet') {
        // Export native sheet to XLSX
        downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`;
    }

    const res = await fetch(downloadUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
        throw new Error('Falha ao fazer download do arquivo do Google Drive');
    }

    return await res.blob();
};
