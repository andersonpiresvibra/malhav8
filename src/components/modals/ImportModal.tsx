import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, Table, User as UserIcon } from 'lucide-react';
import { googleSignIn, getGoogleAccessToken, initGoogleAuth, importFromSpreadsheet, googleLogout, downloadDriveFile } from '../../services/googleSheetsService';
import { User } from 'firebase/auth';

interface ImportModalProps {
    isDarkMode: boolean;
    onClose: () => void;
    onImport: (file: File) => void;
    onImportGoogleSheet?: (data: any[][]) => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({ isDarkMode, onClose, onImport, onImportGoogleSheet }) => {
    const [needsAuth, setNeedsAuth] = useState(false);
    const [token, setToken] = useState<string | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    
    const [spreadsheetId, setSpreadsheetId] = useState('');
    const [sheetRange, setSheetRange] = useState('Página1!A1:Z100');
    const [isLoadingSheet, setIsLoadingSheet] = useState(false);
    const [sheetError, setSheetError] = useState('');

    useEffect(() => {
        const unsubscribe = initGoogleAuth(
            (user, token) => {
                setNeedsAuth(false);
                setUser(user);
                setToken(token);
            },
            () => setNeedsAuth(true)
        );
        return () => {
            if (typeof unsubscribe === 'function') unsubscribe();
        };
    }, []);

    const handleLogin = async () => {
        setIsLoggingIn(true);
        setSheetError('');
        try {
            const result = await googleSignIn();
            if (result) {
                setToken(result.accessToken);
                setUser(result.user);
                setNeedsAuth(false);
            }
        } catch (err: any) {
            console.error('Login failed:', err);
            if (err.message && err.message.includes('popup-closed-by-user')) {
                setSheetError('Login cancelado: A janela de autenticação foi fechada antes de concluir.');
            } else {
                setSheetError(err.message || 'Falha ao autenticar com as contas do Google.');
            }
        } finally {
            setIsLoggingIn(false);
        }
    };

    const handleImportSheet = async () => {
        if (!spreadsheetId.trim() || !sheetRange.trim()) {
             setSheetError('Preencha o ID da planilha e o intervalo (ex: Página1!A1:Z100).');
             return;
        }

        setIsLoadingSheet(true);
        setSheetError('');
        try {
             // Aceitar tanto ID puro quanto URL completa
             let actualId = spreadsheetId.trim();
             const urlMatch = actualId.match(/\/d\/([a-zA-Z0-9-_]+)/);
             if (urlMatch && urlMatch[1]) {
                 actualId = urlMatch[1];
             }

             const data = await importFromSpreadsheet(actualId, sheetRange);
             if (data && data.values && data.values.length > 0) {
                 if (onImportGoogleSheet) {
                     onImportGoogleSheet(data.values);
                     onClose();
                 } else {
                     setSheetError('Função de importação de Sheet não fornecida pelo componente pai.');
                 }
             } else {
                 setSheetError('Nenhum dado encontrado no intervalo especificado.');
             }
        } catch (err: any) {
             console.error('Sheet import error:', err);
             setSheetError(err.message || 'Erro ao importar dados da planilha.');
             if (err.message?.includes('401') || err.message?.includes('autenticado')) {
                 setNeedsAuth(true);
             }
        } finally {
             setIsLoadingSheet(false);
        }
    };

    const handleImportDriveFile = async () => {
        if (!spreadsheetId.trim()) {
            setSheetError('Preencha o ID do arquivo do Google Drive.');
            return;
        }

        setIsLoadingSheet(true);
        setSheetError('');
        try {
            let actualId = spreadsheetId.trim();
            const urlMatch = actualId.match(/\/d\/([a-zA-Z0-9-_]+)/);
            if (urlMatch && urlMatch[1]) {
                actualId = urlMatch[1];
            }

            const blob = await downloadDriveFile(actualId);
            const file = new File([blob], 'drive-import.xlsx', { type: blob.type });
            onImport(file);
            onClose();
        } catch (err: any) {
             console.error('Drive import error:', err);
             setSheetError(err.message || 'Erro ao importar arquivo do Google Drive.');
             if (err.message?.includes('401') || err.message?.includes('autenticado')) {
                 setNeedsAuth(true);
             }
        } finally {
             setIsLoadingSheet(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center animate-in fade-in">
            <div className={`w-full max-w-lg rounded-xl shadow-2xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]`}>
                <div className={`flex justify-between items-center p-6 border-b shrink-0 ${isDarkMode ? 'border-slate-800 bg-slate-950' : 'border-[#004D24] bg-[#004D24]'}`}>
                    <div>
                        <h3 className="text-lg font-bold text-white uppercase tracking-wider">Importar Malha</h3>
                        <p className={`text-xs mt-1 ${isDarkMode ? 'text-slate-400' : 'text-emerald-100'}`}>Carregue dados de voos em lote</p>
                    </div>
                    <button 
                        onClick={onClose}
                        className={`${isDarkMode ? 'text-slate-500 hover:text-white' : 'text-emerald-100 hover:text-white'} transition-colors`}
                    >
                        <X size={24} />
                    </button>
                </div>
                
                <div className="p-6 space-y-6 overflow-y-auto">
                    <div className={`p-4 rounded-lg border ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                        <h4 className={`text-sm font-bold mb-2 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>Importação por Arquivo Local</h4>
                        <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'} mb-3`}>
                            Formatos suportados: Excel (.xlsx, .xls), CSV (.csv) e PDF.
                        </p>
                        <div className="flex justify-start">
                            <input 
                                type="file" 
                                id="file-upload" 
                                className="hidden" 
                                accept=".xlsx, .xls, .csv, .pdf"
                                onChange={(e) => {
                                    if (e.target.files && e.target.files.length > 0) {
                                        onImport(e.target.files[0]);
                                    }
                                }}
                            />
                            <label 
                                htmlFor="file-upload"
                                className="cursor-pointer flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold text-slate-950 bg-emerald-500 hover:bg-emerald-600 transition-colors shadow-sm"
                            >
                                <Upload size={16} />
                                Selecionar Arquivo
                            </label>
                        </div>
                    </div>

                    <div className="relative flex py-2 items-center">
                        <div className="flex-grow border-t border-slate-700"></div>
                        <span className={`flex-shrink-0 mx-4 text-xs font-bold uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>OU</span>
                        <div className="flex-grow border-t border-slate-700"></div>
                    </div>

                    <div className={`p-4 rounded-lg border ${isDarkMode ? 'bg-blue-900/20 border-blue-900/50' : 'bg-blue-50 border-blue-200'}`}>
                        <h4 className={`text-sm font-bold mb-2 flex items-center gap-2 ${isDarkMode ? 'text-blue-400' : 'text-blue-700'}`}>
                            <Table size={16} />
                            Integração com Google Sheets
                        </h4>
                        
                        {needsAuth ? (
                            <div className="mt-4 flex flex-col items-start gap-2">
                                <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Conecte sua conta do Google para importar planilhas diretamente da nuvem.</p>
                                <button className="gsi-material-button mt-2" onClick={handleLogin} disabled={isLoggingIn}>
                                  <div className="gsi-material-button-state"></div>
                                  <div className="gsi-material-button-content-wrapper flex items-center px-4 py-2 bg-white border border-gray-300 rounded shadow-sm hover:bg-gray-50 text-slate-700 text-sm font-medium">
                                    <div className="gsi-material-button-icon mr-3">
                                      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" xmlnsXlink="http://www.w3.org/1999/xlink" style={{display: 'block', width: '18px', height: '18px'}}>
                                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                                        <path fill="none" d="M0 0h48v48H0z"></path>
                                      </svg>
                                    </div>
                                    <span className="gsi-material-button-contents">{isLoggingIn ? 'Conectando...' : 'Sign in with Google'}</span>
                                  </div>
                                </button>
                            </div>
                        ) : (
                            <div className="mt-4 flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                    <p className={`text-xs ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'} font-bold flex items-center gap-1`}>
                                        <UserIcon size={14} /> Conectado como {user?.email}
                                    </p>
                                    <button onClick={googleLogout} className={`text-[10px] uppercase font-bold tracking-wider ${isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700'}`}>Desconectar</button>
                                </div>
                                
                                <div>
                                    <label className={`block text-xs font-bold uppercase tracking-wider mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>URL ou ID do Google Sheets / Drive</label>
                                    <input 
                                        type="text" 
                                        value={spreadsheetId}
                                        onChange={(e) => setSpreadsheetId(e.target.value)}
                                        placeholder="Cole a URL ou o ID aqui..."
                                        className={`w-full px-3 py-2 rounded border text-sm ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-300 text-slate-800'}`}
                                    />
                                </div>
                                <div>
                                    <label className={`block text-xs font-bold uppercase tracking-wider mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Aba e Intervalo (apenas para planilhas)</label>
                                    <input 
                                        type="text" 
                                        value={sheetRange}
                                        onChange={(e) => setSheetRange(e.target.value)}
                                        placeholder="Ex: Página1!A1:Z100"
                                        className={`w-full px-3 py-2 rounded border text-sm ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-300 text-slate-800'}`}
                                    />
                                </div>

                                {sheetError && (
                                    <p className="text-red-500 text-xs font-medium">{sheetError}</p>
                                )}

                                <div className="flex gap-2">
                                    <button 
                                        onClick={handleImportSheet}
                                        disabled={isLoadingSheet}
                                        className={`flex-1 flex justify-center items-center gap-2 py-2 rounded-md font-bold text-sm transition-colors ${isLoadingSheet ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-500/20'}`}
                                    >
                                        Importar como Planilha
                                    </button>
                                    <button 
                                        onClick={handleImportDriveFile}
                                        disabled={isLoadingSheet}
                                        className={`flex-1 flex justify-center items-center gap-2 py-2 rounded-md font-bold text-sm transition-colors ${isLoadingSheet ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-500/20'}`}
                                    >
                                        Importar Arquivo do Drive
                                    </button>
                                </div>
                                <p className={`text-[10px] mt-2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'} text-center`}>Os dados extraídos da planilha ou arquivo serão integrados com permissões do aplicativo.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
