import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, CircularProgress } from '@mui/material';
import { motion } from 'framer-motion';
import DriverSelector from '../selectors/DriverSelector';
import { fetchDrivers, type DriverProfile } from '../../api/referenceApi';
import { useUser } from '../../context/UserContext';

interface UserSettingsModalProps {
    open: boolean;
    onClose: () => void;
}

const UserSettingsModal: React.FC<UserSettingsModalProps> = ({ open, onClose }) => {
    const { userProfile, updatePreferences } = useUser();
    const [drivers, setDrivers] = useState<DriverProfile[]>([]);
    const [selectedDriver, setSelectedDriver] = useState<DriverProfile | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!open) return;
        setIsLoading(true);
        fetchDrivers()
            .then(data => {
                setDrivers(data);
                if (userProfile?.preferences?.favoriteDriver) {
                    const fav = data.find(d => d.code === userProfile.preferences.favoriteDriver);
                    if (fav) setSelectedDriver(fav);
                }
            })
            .finally(() => setIsLoading(false));
    }, [userProfile, open]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await updatePreferences({
                ...userProfile?.preferences,
                favoriteDriver: selectedDriver?.code || undefined
            });
            onClose();
        } catch (e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} PaperProps={{
            component: motion.div,
            initial: { opacity: 0, scale: 0.95 },
            animate: { opacity: 1, scale: 1 },
            exit: { opacity: 0, scale: 0.95 },
            transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
            sx: { bgcolor: '#1e1e1e', color: 'white', minWidth: 400, border: '1px solid #333' }
        }}>
            <DialogTitle sx={{ borderBottom: '1px solid #333', pb: 2 }}>⚙️ USER PREFERENCES</DialogTitle>
            <DialogContent sx={{ pt: 3 }}>
                {isLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 6 }}>
                        <CircularProgress size={40} />
                    </Box>
                ) : (
                    <Box sx={{ mt: 2 }}>
                        <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>DEFAULT DRIVER CHANNEL</Typography>
                        <DriverSelector
                            label="Select Driver"
                            options={drivers}
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