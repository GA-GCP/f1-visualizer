import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LayoutMain from './components/layout/LayoutMain';
import Home from './pages/Home';

const darkTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: { main: '#e10600' }, // F1 Red
        secondary: { main: '#FF8700' }, // McLaren Papaya
        background: { default: '#121212', paper: '#1e1e1e' },
        text: { primary: '#ffffff', secondary: '#b0b0b0' },
    },
    typography: {
        fontFamily: '"Titillium Web", "Roboto", "Helvetica", "Arial", sans-serif',
        h4: { textTransform: 'uppercase', letterSpacing: '0.05em' },
        h6: { textTransform: 'uppercase' }
    },
    components: {
        MuiAppBar: {
            styleOverrides: {
                root: { backgroundColor: '#181818' }
            }
        }
    }
});

function App() {
    return (
        <ThemeProvider theme={darkTheme}>
            <CssBaseline />
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<LayoutMain />}>
                        <Route index element={<Home />} />
                        {/* Placeholder for future Historical Data page */}
                        <Route path="historical" element={<Home />} />
                    </Route>
                </Routes>
            </BrowserRouter>
        </ThemeProvider>
    );
}

export default App;