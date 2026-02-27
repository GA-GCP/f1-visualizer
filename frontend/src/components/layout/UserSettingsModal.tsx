import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography } from '@mui/material';
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

    useEffect(() => {
        fetchDrivers().then(data => {
            setDrivers(data);
            // If the user already has a favorite saved in Firestore, pre-select it
            if (userProfile?.preferences?.favoriteDriver) {
                const fav = data.find(d => d.code === userProfile.preferences.favoriteDriver);
                if (fav) setSelectedDriver(fav);
            }
        });
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
        <Dialog open={open} onClose={onClose} PaperProps={{ sx: { bgcolor: '#1e1e1e', color: 'white', minWidth: 400, border: '1px solid #333' } }}>
            <DialogTitle sx={{ borderBottom: '1px solid #333', pb: 2 }}>⚙️ USER PREFERENCES</DialogTitle>
            <DialogContent sx={{ pt: 3 }}>
                <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>DEFAULT DRIVER CHANNEL</Typography>
                    <DriverSelector
                        label="Select Driver"
                        options={drivers}
                        value={selectedDriver}
                        onChange={setSelectedDriver}
                    />
                </Box>
            </DialogContent>
            <DialogActions sx={{ p: 2, borderTop: '1px solid #333' }}>
                <Button onClick={onClose} color="inherit">Cancel</Button>
                <Button onClick={handleSave} variant="contained" color="primary" disabled={isSaving}>
                    {isSaving ? 'SAVING...' : 'SAVE SETTINGS'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default UserSettingsModal;