import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, CircularProgress, Alert , useMediaQuery, useTheme } from '@mui/material';
import type { DialogProps } from '@mui/material';
import { motion } from 'framer-motion';
import DriverSelector from '../selectors/DriverSelector';
import { useQuery } from '@tanstack/react-query';
import { queries } from '../../api/queries';
import type { DriverProfile } from '../../api/referenceApi';
import { useUser } from '../../context/UserContext';
import { createLogger } from '../../lib/logger';
import { PAPER_BG } from '../../theme/tokens';

const log = createLogger('settings');

interface UserSettingsModalProps {
    open: boolean;
    onClose: () => void;
}

const UserSettingsModal: React.FC<UserSettingsModalProps> = ({ open, onClose }) => {
    const theme = useTheme();
    const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));
    const { userProfile, updatePreferences } = useUser();
    /** Only what the user picked in this dialog; the default is derived below. */
    const [chosenDriver, setChosenDriver] = useState<DriverProfile | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Cached across opens now: reopening the dialog no longer refetches, and the
    // spinner only appears the first time.
    const driversQuery = useQuery({ ...queries.drivers(), enabled: open });
    const drivers = driversQuery.data ?? null;
    const isLoading = open && driversQuery.isPending;

    // Derived rather than seeded by an effect: the saved favourite is the
    // default until the user picks something else in this dialog.
    const savedFavourite = userProfile?.preferences?.favoriteDriver;
    const selectedDriver = chosenDriver
        ?? drivers?.find(d => d.code === savedFavourite)
        ?? null;

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
            log.error('Failed to save preferences', e);
            setErrorMsg('Failed to save preferences. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            // minWidth: 400 overflowed a 375px viewport horizontally. Full
            // screen below `sm` is the standard answer and avoids the scroll.
            fullScreen={isSmallScreen}
            slots={{ paper: motion.div }}
            slotProps={{
                paper: {
                    initial: { opacity: 0, scale: 0.95 },
                    animate: { opacity: 1, scale: 1 },
                    exit: { opacity: 0, scale: 0.95 },
                    transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] as const },
                    sx: { bgcolor: PAPER_BG, color: 'white', minWidth: { xs: 'auto', sm: 400 }, border: '1px solid #333' }
                } as NonNullable<DialogProps['slotProps']>['paper']
            }}
        >
            <DialogTitle sx={{ borderBottom: '1px solid #333', pb: 2 }}>
                <span aria-hidden="true">⚙️</span> USER PREFERENCES
            </DialogTitle>
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
                            onChange={setChosenDriver}
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