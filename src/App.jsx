import React, { Suspense, useMemo, useState } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import {
  AppBar,
  Box,
  Checkbox,
  CircularProgress,
  Container,
  FormControl,
  InputLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Paper,
  Select,
  Toolbar,
  Typography,
} from '@mui/material';

// Minimal admin host:
// - One page (catch-all route) that always renders Wishlist and optionally renders other MFEs.
// - No extra routes/config pages.

const RemoteWishlist = React.lazy(() => import('wishlist/Wishlist'));
const RemoteLogin = React.lazy(() => import('auth/Login'));
const RemoteProducts = React.lazy(() => import('catalog/Products'));
const RemoteCart = React.lazy(() => import('checkout/Cart'));
const RemoteAccount = React.lazy(() => import('account/Account'));

function Loader() {
  return (
    <Box sx={{ minHeight: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <CircularProgress size={28} />
    </Box>
  );
}

class RemoteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    // Reason: keep the host usable when a remote crashes intentionally.
    // eslint-disable-next-line no-console
    console.error('[admin-host] Remote crashed:', this.props?.title, error);
    if (window.zipy) window.zipy.logException(error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid rgba(211,47,47,0.35)', bgcolor: 'white' }}>
        <Typography variant="h6" sx={{ fontWeight: 950, mb: 1 }}>
          {this.props.title} crashed
        </Typography>
        <Typography variant="body2" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }} color="text.secondary">
          {String(this.state.error?.message ?? this.state.error)}
        </Typography>
      </Paper>
    );
  }
}

function Section({ title, children }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, md: 3 },
        borderRadius: 3,
        border: '1px solid rgba(0,0,0,0.06)',
        background: 'rgba(255, 255, 255, 0.92)',
        backdropFilter: 'blur(20px)',
      }}
    >
      <Typography variant="h6" sx={{ fontWeight: 950, mb: 1 }}>
        {title}
      </Typography>
      {children}
    </Paper>
  );
}

function AdminHome() {
  const [selected, setSelected] = useState([]);

  // Minimal state/handlers to satisfy MFE contracts.
  const [wishlistItems, setWishlistItems] = useState([]);
  const [cartItems, setCartItems] = useState([]);
  const adminUser = useMemo(
    () => ({ name: 'Admin', email: 'admin@shophub.dev', role: 'ADMIN', permissions: ['EDIT', 'VIEW_WISHLIST_META'] }),
    [],
  );

  const addToCart = async (product) => {
    setCartItems((prev) => {
      const existing = prev.find((x) => x?.id === product?.id);
      if (existing) return prev.map((x) => (x.id === product.id ? { ...x, quantity: (x.quantity ?? 1) + 1 } : x));
      return [...prev, { ...product, quantity: 1 }];
    });
    return true;
  };

  const removeFromCart = async (productId) => {
    setCartItems((prev) => prev.filter((x) => x?.id !== productId));
  };

  const updateQuantity = async (productId, quantity) => {
    setCartItems((prev) => prev.map((x) => (x?.id === productId ? { ...x, quantity } : x)));
  };

  const clearCart = async () => setCartItems([]);

  const removeFromWishlist = (productId) => setWishlistItems((prev) => prev.filter((x) => x?.id !== productId));
  const clearWishlist = () => setWishlistItems([]);
  const addToWishlist = (product) =>
    setWishlistItems((prev) => {
      if (prev.some((x) => x?.id === product?.id)) return prev;
      return [{ ...product, addedBy: adminUser }, ...prev];
    });
  const isInWishlist = (productId) => wishlistItems.some((x) => x?.id === productId);

  const showSuccess = (message) => {
    // Reason: keep admin host minimal; snackbar can be added later if needed.
    // eslint-disable-next-line no-console
    console.log('[admin-host][success]', message);
  };
  const showError = (message) => {
    // eslint-disable-next-line no-console
    console.error('[admin-host][error]', message);
  };

  const getCartTotal = () =>
    cartItems.reduce((sum, item) => sum + (Number(item?.price) || 0) * (Number(item?.quantity) || 0), 0);
  const isCartEmpty = () => cartItems.length === 0;

  const items = useMemo(
    () => [
      {
        id: 'auth.login',
        label: 'Auth → Login',
        render: () => <RemoteLogin login={async () => ({ success: true })} loading={false} />,
      },
      {
        id: 'catalog.products',
        label: 'Catalog → Products',
        render: () => (
          <RemoteProducts
            addToCart={addToCart}
            showError={showError}
            addToWishlist={addToWishlist}
            isInWishlist={isInWishlist}
          />
        ),
      },
      {
        id: 'checkout.cart',
        label: 'Checkout → Cart',
        render: () => (
          <RemoteCart
            cartItems={cartItems}
            removeFromCart={removeFromCart}
            updateQuantity={updateQuantity}
            getCartTotal={getCartTotal}
            isCartEmpty={isCartEmpty}
            clearCart={clearCart}
            showError={showError}
            wishlistItems={wishlistItems}
            removeFromWishlist={removeFromWishlist}
            clearWishlist={clearWishlist}
            showSuccess={showSuccess}
          />
        ),
      },
      {
        id: 'account.profile',
        label: 'Account → Profile',
        render: () => <RemoteAccount />,
      },
    ],
    [cartItems, wishlistItems],
  );

  const selectedItems = useMemo(() => {
    const byId = new Map(items.map((x) => [x.id, x]));
    return selected.map((id) => byId.get(id)).filter(Boolean);
  }, [items, selected]);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#fafafa' }}>
      <AppBar position="sticky" elevation={0} sx={{ borderBottom: '1px solid rgba(0,0,0,0.06)', bgcolor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(16px)' }}>
        <Container maxWidth="xl">
          <Toolbar sx={{ justifyContent: 'space-between' }}>
            <Typography variant="h6" sx={{ fontWeight: 950, letterSpacing: '-0.02em' }}>
              ShopHub
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
              Home
            </Typography>
          </Toolbar>
        </Container>
      </AppBar>

      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid rgba(0,0,0,0.06)', mb: 3, bgcolor: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(20px)' }}>
          <FormControl fullWidth size="small">
            <InputLabel id="mfe-select-label">Render MFEs</InputLabel>
            <Select
              labelId="mfe-select-label"
              multiple
              value={selected}
              onChange={(e) => {
                const value = e.target.value;
                setSelected(typeof value === 'string' ? value.split(',') : value);
              }}
              input={<OutlinedInput label="Render MFEs" />}
              renderValue={(ids) => {
                const byId = new Map(items.map((x) => [x.id, x.label]));
                return ids.map((id) => byId.get(id) ?? id).join(', ');
              }}
            >
              {items.map((opt) => (
                <MenuItem key={opt.id} value={opt.id}>
                  <Checkbox checked={selected.includes(opt.id)} />
                  <ListItemText primary={opt.label} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Paper>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 3 }}>
          <RemoteErrorBoundary title="Wishlist">
            <Section title="Wishlist">
              <Suspense fallback={<Loader />}>
                <RemoteWishlist
                  items={wishlistItems}
                  removeFromWishlist={removeFromWishlist}
                  clearWishlist={clearWishlist}
                  addToCart={addToCart}
                  showError={showError}
                  showSuccess={showSuccess}
                  currentUser={adminUser}
                />
              </Suspense>
            </Section>
          </RemoteErrorBoundary>

          {selectedItems.map((it) => (
            <RemoteErrorBoundary key={it.id} title={it.label}>
              <Section title={it.label}>
                <Suspense fallback={<Loader />}>{it.render()}</Suspense>
              </Section>
            </RemoteErrorBoundary>
          ))}
        </Box>
      </Container>
    </Box>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Catch-all: keep admin shell minimal while avoiding 404s when MFEs navigate. */}
        <Route path="*" element={<AdminHome />} />
      </Routes>
    </Router>
  );
}

