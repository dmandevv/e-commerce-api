"use strict";
/**
 * Database Seed Script
 *
 * Populates MongoDB with an admin user and realistic product catalog.
 * Run: npx tsx scripts/seed.ts
 *
 * Uses the same connection strings as the services, so it works both
 * locally (Docker Compose) and against production (set env vars).
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var mongoose_1 = __importDefault(require("mongoose"));
var bcryptjs_1 = __importDefault(require("bcryptjs"));
// ─── Config ──────────────────────────────────────────────
var MONGO_URI = process.env.MONGO_URI || '';
var ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'dev@dmandevv.shop';
var ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@Ecom2026!';
var ADMIN_NAME = process.env.ADMIN_NAME || 'Admin';
// ─── Safety Guard ────────────────────────────────────────
var isProduction = MONGO_URI.includes('mongodb+srv');
var isFreshSeed = process.argv.includes('--fresh');
if (isProduction && isFreshSeed) {
    console.error('❌ SAFETY: Refusing to run --fresh seed on production database!');
    console.error('   To re-seed production, set: CONFIRM_PRODUCTION_SEED=true');
    console.error('   Then run: CONFIRM_PRODUCTION_SEED=true npx tsx scripts/seed.ts --fresh');
    if (!process.env.CONFIRM_PRODUCTION_SEED) {
        process.exit(1);
    }
    console.warn('⚠️  WARNING: Proceeding with --fresh seed on PRODUCTION database!');
}
// ─── Products ────────────────────────────────────────────
var products = [
    {
        name: 'Sony WH-1000XM5 Headphones',
        description: 'Industry-leading noise cancellation with Auto NC Optimizer, crystal-clear hands-free calling, and up to 30 hours of battery life.',
        price: 348.0,
        category: 'Electronics',
        stock: 45,
        rating: 4.7,
        numOfReviews: 3,
        reviews: [
            { userId: 'seed', name: 'Alex M.', rating: 5, comment: 'Best noise cancellation I\'ve ever experienced.' },
            { userId: 'seed', name: 'Jordan K.', rating: 4, comment: 'Great sound quality, but the touch controls are finnicky.' },
            { userId: 'seed', name: 'Sam R.', rating: 5, comment: 'Worth every penny. My daily driver for WFH.' },
        ],
    },
    {
        name: 'Canon EOS R6 Mark II',
        description: 'Full-frame mirrorless camera with 24.2 MP sensor, 4K 60p video, and subject detection AF. Perfect for photos and video.',
        price: 2499.0,
        category: 'Electronics',
        stock: 12,
        rating: 4.8,
        numOfReviews: 2,
        reviews: [
            { userId: 'seed', name: 'Chris P.', rating: 5, comment: 'The autofocus is incredible. Tracks eyes even in low light.' },
            { userId: 'seed', name: 'Taylor W.', rating: 5, comment: 'Upgraded from the R6 — the improvements are noticeable.' },
        ],
    },
    {
        name: 'MacBook Pro 16" M3 Pro',
        description: '16-inch Liquid Retina XDR display, M3 Pro chip, 18GB unified memory, 512GB SSD. Built for professional workflows.',
        price: 2499.0,
        category: 'Computers',
        stock: 20,
        rating: 4.9,
        numOfReviews: 2,
        reviews: [
            { userId: 'seed', name: 'Dev Team', rating: 5, comment: 'Compiles our monorepo in half the time. Battery lasts all day.' },
            { userId: 'seed', name: 'Morgan L.', rating: 5, comment: 'The screen is gorgeous for photo editing.' },
        ],
    },
    {
        name: 'Logitech MX Master 3S',
        description: 'Wireless ergonomic mouse with 8K DPI tracking, quiet clicks, and MagSpeed scroll wheel. Works on any surface.',
        price: 99.99,
        category: 'Electronics',
        stock: 150,
        rating: 4.6,
        numOfReviews: 4,
        reviews: [
            { userId: 'seed', name: 'Pat N.', rating: 5, comment: 'The scroll wheel alone is worth the price.' },
            { userId: 'seed', name: 'Riley T.', rating: 4, comment: 'Comfortable for long sessions, but Bluetooth can lag.' },
            { userId: 'seed', name: 'Quinn D.', rating: 5, comment: 'Paired with three devices seamlessly.' },
            { userId: 'seed', name: 'Casey B.', rating: 4, comment: 'Great mouse, wish it was USB-C to charge though. Oh wait, it is!' },
        ],
    },
    {
        name: 'Samsung Galaxy S24 Ultra',
        description: 'Titanium build, 200MP camera, S Pen built-in, Snapdragon 8 Gen 3, 5000mAh battery. The ultimate Android phone.',
        price: 1299.99,
        category: 'Electronics',
        stock: 30,
        rating: 4.5,
        numOfReviews: 3,
        reviews: [
            { userId: 'seed', name: 'Jamie R.', rating: 5, comment: 'Camera is insane. Night mode rivals dedicated cameras.' },
            { userId: 'seed', name: 'Avery S.', rating: 4, comment: 'Battery life could be better with the QHD display on.' },
            { userId: 'seed', name: 'Drew H.', rating: 5, comment: 'The S Pen integration is underrated.' },
        ],
    },
    {
        name: 'Sony A7 IV Camera',
        description: '33MP full-frame sensor, 4K 60p, real-time Eye AF, 10fps burst shooting. The hybrid camera for stills and video.',
        price: 2498.0,
        category: 'Electronics',
        stock: 8,
        rating: 4.7,
        numOfReviews: 1,
        reviews: [
            { userId: 'seed', name: 'Kai L.', rating: 5, comment: 'The best all-around camera you can buy at this price.' },
        ],
    },
    {
        name: 'Lenovo ThinkPad X1 Carbon Gen 11',
        description: '14-inch 2.8K OLED display, Intel i7-1365U, 16GB RAM, 512GB SSD. 2.48 lbs. The business ultrabook standard.',
        price: 1649.0,
        category: 'Computers',
        stock: 25,
        rating: 4.4,
        numOfReviews: 2,
        reviews: [
            { userId: 'seed', name: 'Jordan M.', rating: 4, comment: 'Best keyboard on any laptop. Period.' },
            { userId: 'seed', name: 'Alex C.', rating: 5, comment: 'Light enough for travel, powerful enough for dev work.' },
        ],
    },
    {
        name: 'Apple AirPods Pro 2',
        description: 'Active noise cancellation, adaptive transparency, personalized spatial audio, MagSafe charging case with speaker and lanyard loop.',
        price: 249.0,
        category: 'Electronics',
        stock: 100,
        rating: 4.6,
        numOfReviews: 3,
        reviews: [
            { userId: 'seed', name: 'Sam T.', rating: 5, comment: 'The adaptive transparency mode is magic.' },
            { userId: 'seed', name: 'Robin P.', rating: 4, comment: 'Sound quality is great but doesn\'t beat over-ear cans.' },
            { userId: 'seed', name: 'Morgan W.', rating: 5, comment: 'Find My on the case has already saved me once.' },
        ],
    },
    {
        name: 'Keychron Q1 Pro Mechanical Keyboard',
        description: 'Wireless 75% layout, Gateron Jupiter Brown switches, QMK/VIA compatible, full aluminum body, hot-swappable.',
        price: 199.0,
        category: 'Electronics',
        stock: 60,
        rating: 4.8,
        numOfReviews: 2,
        reviews: [
            { userId: 'seed', name: 'Dev User', rating: 5, comment: 'VIA support is a game-changer for custom layouts.' },
            { userId: 'seed', name: 'Tyler K.', rating: 5, comment: 'Build quality is phenomenal for the price.' },
        ],
    },
    {
        name: 'Organic Dark Roast Coffee Beans (2 lb)',
        description: 'Single-origin Peruvian dark roast. Fair trade, USDA organic. Rich chocolate and caramel notes with low acidity.',
        price: 24.99,
        category: 'Food & Grocery',
        stock: 200,
        rating: 4.3,
        numOfReviews: 2,
        reviews: [
            { userId: 'seed', name: 'Coffee Lover', rating: 4, comment: 'Smooth for a dark roast. Great for cold brew.' },
            { userId: 'seed', name: 'Bailey R.', rating: 5, comment: 'My new daily driver. Low acidity is a big plus.' },
        ],
    },
];
// ─── Seed Logic ──────────────────────────────────────────
function seed() {
    return __awaiter(this, void 0, void 0, function () {
        var userConn, UserSchema, User, hashedPassword, productConn, ProductSchema, Product, existingCount, admin, adminId, productsWithCreator;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    console.log('🌱 Starting database seed...\n');
                    return [4 /*yield*/, mongoose_1.default.createConnection("".concat(MONGO_URI, "/user-service")).asPromise()];
                case 1:
                    userConn = _b.sent();
                    UserSchema = new mongoose_1.default.Schema({
                        name: String,
                        email: { type: String, unique: true },
                        password: String,
                        role: { type: String, default: 'customer' },
                    }, { timestamps: true });
                    User = userConn.model('User', UserSchema);
                    return [4 /*yield*/, bcryptjs_1.default.hash(ADMIN_PASSWORD, 10)];
                case 2:
                    hashedPassword = _b.sent();
                    return [4 /*yield*/, User.findOneAndUpdate({ email: ADMIN_EMAIL }, { name: ADMIN_NAME, password: hashedPassword, role: 'admin' }, { upsert: true, new: true })];
                case 3:
                    _b.sent();
                    console.log("\u2713 Admin user upserted (".concat(ADMIN_EMAIL, " / ").concat(ADMIN_PASSWORD, ")"));
                    return [4 /*yield*/, mongoose_1.default.createConnection("".concat(MONGO_URI, "/product-service")).asPromise()];
                case 4:
                    productConn = _b.sent();
                    ProductSchema = new mongoose_1.default.Schema({
                        name: String,
                        description: String,
                        price: Number,
                        category: String,
                        stock: Number,
                        images: [{ publicId: String, url: String }],
                        reviews: [{ userId: String, name: String, rating: Number, comment: String }],
                        rating: { type: Number, default: 0 },
                        numOfReviews: { type: Number, default: 0 },
                        createdBy: String,
                    }, { timestamps: true });
                    Product = productConn.model('Product', ProductSchema);
                    return [4 /*yield*/, Product.countDocuments()];
                case 5:
                    existingCount = _b.sent();
                    if (!(existingCount > 0)) return [3 /*break*/, 10];
                    console.log("\u2713 Products already seeded (".concat(existingCount, " found). Skipping."));
                    console.log('  To re-seed, run: npx tsx scripts/seed.ts --fresh');
                    if (!process.argv.includes('--fresh')) return [3 /*break*/, 7];
                    return [4 /*yield*/, Product.deleteMany({})];
                case 6:
                    _b.sent();
                    console.log('  Cleared existing products.');
                    return [3 /*break*/, 10];
                case 7: return [4 /*yield*/, userConn.close()];
                case 8:
                    _b.sent();
                    return [4 /*yield*/, productConn.close()];
                case 9:
                    _b.sent();
                    console.log('\n✅ Seed complete.');
                    process.exit(0);
                    _b.label = 10;
                case 10: return [4 /*yield*/, User.findOne({ email: ADMIN_EMAIL })];
                case 11:
                    admin = _b.sent();
                    adminId = ((_a = admin === null || admin === void 0 ? void 0 : admin._id) === null || _a === void 0 ? void 0 : _a.toString()) || 'seed-admin';
                    productsWithCreator = products.map(function (p) { return (__assign(__assign({}, p), { createdBy: adminId, images: [{ publicId: 'placeholder', url: 'https://via.placeholder.com/300x300.png?text=' + encodeURIComponent(p.name) }] })); });
                    return [4 /*yield*/, Product.insertMany(productsWithCreator)];
                case 12:
                    _b.sent();
                    console.log("\u2713 ".concat(products.length, " products seeded"));
                    // --- Cleanup ---
                    return [4 /*yield*/, userConn.close()];
                case 13:
                    // --- Cleanup ---
                    _b.sent();
                    return [4 /*yield*/, productConn.close()];
                case 14:
                    _b.sent();
                    console.log('\n✅ Seed complete.');
                    console.log("\n  Admin login: ".concat(ADMIN_EMAIL, " / ").concat(ADMIN_PASSWORD));
                    console.log('  Products: 10 items across 5 categories');
                    process.exit(0);
                    return [2 /*return*/];
            }
        });
    });
}
seed().catch(function (err) {
    console.error('Seed failed:', err);
    process.exit(1);
});
