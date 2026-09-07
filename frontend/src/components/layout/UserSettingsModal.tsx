import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, CircularProgress, Alert } from '@mui/material';
import type { DialogProps } from '@mui/material';
import { motion } from 'framer-motion';
import DriverSelector from '../selectors/DriverSelector';
import { fetchDrivers, type DriverProfile } from '../../api/referenceApi';
import { isRequestCancelled } from '../../api/apiClient';
import { useUser } from '../../context/UserContext';

interface UserSettingsModalProps {
    open: boolean;
    onClose: () => void;
}

const UserSettingsModal: React.FC<UserSettingsModalProps> = ({ open, onClose }) => {
    const { userProfile, updatePreferences } = useUser();
    // `null` means "not fetched yet", so the absence of data *is* the loading
    // state. That removes the need to synchronously flip a boolean inside the
    // effect, which cascades renders.
    const [drivers, setDrivers] = useState<DriverProfile[] | null>(null);
    const [selectedDriver, setSelectedDriver] = useState<DriverProfile | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const isLoading = open && drivers === null;

    useEffect(() => {
        if (!open) return;
        const controller = new AbortController();

        fetchDrivers(controller.signal)
            .then(data => {
                setDrivers(data);
                const favourite = userProfile?.preferences?.favoriteDriver;
                if (favourite) {
                    const fav = data.find(d => d.code === favourite);
                    if (fav) setSelectedDriver(fav);
                }
            })
            .catch(error => {
                if (isRequestCancelled(error)) return;
                console.error('Failed to load drivers', error);
                // Leaving `drivers` null would strand the spinner.
                setDrivers([]);
            });

        // Discarding the data on close means reopening the dialog (or a profile
        // change) shows the spinner again, as it did before.
        return () => {
            controller.abort();
            setDrivers(null);
        };
    }, [userProfile, open]);

    const handleSave = async () => {
        setIsSaving(true);
        setErrorMsg(null);
        try {
            await updatePreferences({
                ...userProfile?.preferences,
                favoriteDriver: selectedDriver?.code || undefined
            });
            onClose();
        } catch (e) {
            console.error(e);
            setErrorMsg('Failed to save preferences. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            slots={{ paper: motion.div }}
            slotProps={{
                paper: {
                    initial: { opacity: 0, scale: 0.95 },
                    animate: { opacity: 1, scale: 1 },
                    exit: { opacity: 0, scale: 0.95 },
                    transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] as const },
                    sx: { bgcolor: '#1e1e1e', color: 'white', minWidth: 400, border: '1px solid #333' }
                } as NonNullable<DialogProps['slotProps']>['paper']
            }}
        >
            <DialogTitle sx={{ borderBottom: '1px solid #333', pb: 2 }}>⚙️ USER PREFERENCES</DialogTitle>
            <DialogContent sx={{ pt: 3 }}>
                {errorMsg && (
                    <Alert severity="error" sx={{ mb: 2 }}>{errorMsg}</Alert>
                )}
                {isLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 6 }}>
                        <CircularProgress size={40} />
                    </Box>
                ) : (
                    <Box sx={{ mt: 2 }}>
                        <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>DEFAULT DRIVER CHANNEL</Typography>
                        <DriverSelector
                            label="Select Driver"
                            options={drivers ?? []}
                            value={selectedDriver}
                            onChange={setSelectedDriver}
                        />
                    </Box>
                )}
            </DialogContent>
            <DialogActions sx={{ p: 2, borderTop: '1px solid #333' }}>
                <Button onClick={onClose} color="inherit">Cancel</Button>
                <Button onClick={handleSave} variant="contained" color="primary" disabled={isSaving || isLoading}>
                    {isSaving ? 'SAVING...' : 'SAVE SETTINGS'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default UserSettingsModal;