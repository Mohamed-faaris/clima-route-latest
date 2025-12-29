using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using System.Text;
using System.Security.Cryptography;

var builder = WebApplication.CreateBuilder(args);

// 1. SETUP SERVICES

// Database Configuration - PostgreSQL for Production, SQLite for Development
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
var usePostgres = !string.IsNullOrEmpty(connectionString) && connectionString.Contains("Host=");

builder.Services.AddDbContext<AppDbContext>(options => {
    if (usePostgres)
    {
        // Production: PostgreSQL
        options.UseNpgsql(connectionString);
        Console.WriteLine("📦 Using PostgreSQL database");
    }
    else
    {
        // Development: SQLite (fallback)
        options.UseSqlite("Data Source=climaroute.db");
        Console.WriteLine("📦 Using SQLite database (development mode)");
    }
});

// AI Service URL Configuration
var aiServiceUrl = builder.Configuration["AI_SERVICE_URL"] ?? "http://127.0.0.1:5001";
Console.WriteLine($"🤖 AI Service URL: {aiServiceUrl}");

// Host URL Configuration
var hostUrl = builder.Configuration["HOST_URL"] ?? "http://localhost:5000";
Console.WriteLine($"🏠 Host URL: {hostUrl}");

// CORS Configuration
var allowedOrigins = builder.Configuration["ALLOWED_ORIGINS"]?.Split(',', StringSplitOptions.RemoveEmptyEntries) ?? new[] { "*" };
Console.WriteLine($"🌐 Allowed Origins: {string.Join(", ", allowedOrigins)}");

builder.Services.AddCors(options => {
    options.AddPolicy("AllowReact", policy => {
        policy.SetIsOriginAllowed(_ => true) // Allow any origin
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});
builder.Services.AddHttpClient(); 
builder.Services.AddControllers();

var app = builder.Build();

app.UseRouting();
app.UseCors("AllowReact");

// 2. DATABASE INIT - ENSURE PERSISTENCE
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    
    // Ensure database is created (but don't delete it if it exists)
    db.Database.EnsureCreated();
    
    // Add VehicleId column if it doesn't exist (for existing databases)
    try {
        db.Database.ExecuteSqlRaw("ALTER TABLE Users ADD COLUMN VehicleId TEXT DEFAULT ''");
        Console.WriteLine("Added VehicleId column to Users table");
    } catch {
        // Column already exists, ignore
    }
    
    // Add new SosAlert columns if they don't exist
    try {
        db.Database.ExecuteSqlRaw("ALTER TABLE SosAlerts ADD COLUMN DriverName TEXT DEFAULT ''");
        Console.WriteLine("Added DriverName column to SosAlerts table");
    } catch { }
    try {
        db.Database.ExecuteSqlRaw("ALTER TABLE SosAlerts ADD COLUMN CreatedAt TEXT DEFAULT ''");
        Console.WriteLine("Added CreatedAt column to SosAlerts table");
    } catch { }
    try {
        db.Database.ExecuteSqlRaw("ALTER TABLE SosAlerts ADD COLUMN ResolvedAt TEXT");
        Console.WriteLine("Added ResolvedAt column to SosAlerts table");
    } catch { }
    
    // Add new Notification columns for alert types
    try {
        db.Database.ExecuteSqlRaw("ALTER TABLE Notifications ADD COLUMN Type TEXT DEFAULT ''");
        Console.WriteLine("Added Type column to Notifications table");
    } catch { }
    try {
        db.Database.ExecuteSqlRaw("ALTER TABLE Notifications ADD COLUMN Severity TEXT DEFAULT ''");
        Console.WriteLine("Added Severity column to Notifications table");
    } catch { }
    try {
        db.Database.ExecuteSqlRaw("ALTER TABLE Notifications ADD COLUMN UserEmail TEXT DEFAULT ''");
        Console.WriteLine("Added UserEmail column to Notifications table");
    } catch { }
    
    // Add UserEmail column to Weathers table for user-specific weather data
    try {
        db.Database.ExecuteSqlRaw("ALTER TABLE Weathers ADD COLUMN UserEmail TEXT DEFAULT ''");
        Console.WriteLine("Added UserEmail column to Weathers table");
    } catch { }
    
    // Fix old SosAlerts with empty CreatedAt - set to current UTC time
    try {
        var now = DateTime.UtcNow.ToString("o"); // ISO 8601 format
        db.Database.ExecuteSqlRaw($"UPDATE SosAlerts SET CreatedAt = '{now}' WHERE CreatedAt IS NULL OR CreatedAt = ''");
        Console.WriteLine("Fixed empty CreatedAt values in SosAlerts table");
    } catch (Exception ex) {
        Console.WriteLine($"Note: Could not fix CreatedAt values: {ex.Message}");
    }
    
    // Only seed if no users exist to ensure data persistence
    if (!db.Users.Any())
    {
        // Seed fresh users with new credentials
        var adminPwd = "admin";
        var driverPwd = "driver";

        var adminUser = new User { 
            Email = "admin@gmail.com", 
            Name = "Administrator", 
            Phone = "+91-9876543210", 
            Password = HashPassword(adminPwd), 
            PlainPassword = adminPwd, 
            Role = "admin", 
            Status = "Active" 
        };
        
        var driverUser = new User { 
            Email = "driver@gmail.com", 
            Name = "Driver", 
            Phone = "+91-8765432109", 
            Password = HashPassword(driverPwd), 
            PlainPassword = driverPwd, 
            Role = "user", 
            Status = "Active" 
        };
        
        db.Users.Add(adminUser);
        db.Users.Add(driverUser);
        db.SaveChanges();
        
        Console.WriteLine("===========================================");
        Console.WriteLine("DATABASE INITIALIZED AND SEEDED!");
        Console.WriteLine("===========================================");
        Console.WriteLine("Admin:  admin@gmail.com / admin");
        Console.WriteLine("Driver: driver@gmail.com / driver");
        Console.WriteLine("===========================================");
    }
    else
    {
        Console.WriteLine("===========================================");
        Console.WriteLine("DATABASE LOADED SUCCESSFULLY!");
        Console.WriteLine("===========================================");
    }
}

// 3. API ENDPOINTS

// Root API check
app.MapMethods("/api", new[] { "GET", "POST", "PUT", "DELETE", "OPTIONS" }, () => Results.Ok(new { 
    message = "Climate Route API is working", 
    status = "online",
    methods_allowed = "GET, POST, PUT, DELETE, OPTIONS"
}));

// --- HEALTH CHECK (Required for Docker/Kubernetes) ---
app.MapGet("/health", () => Results.Ok(new { status = "healthy", timestamp = DateTime.UtcNow }));
app.MapGet("/api/health", () => Results.Ok(new { status = "healthy", timestamp = DateTime.UtcNow }));

app.MapGet("/ready", async (IHttpClientFactory clientFactory) => {
    var http = clientFactory.CreateClient();
    try {
        // Check if AI service is reachable
        var aiResponse = await http.GetAsync($"{aiServiceUrl}/health");
        if (aiResponse.IsSuccessStatusCode) {
            return Results.Ok(new { status = "ready", ai_service = "connected" });
        }
        return Results.Json(new { status = "degraded", ai_service = "unavailable" }, statusCode: 503);
    } catch {
        return Results.Json(new { status = "degraded", ai_service = "unreachable" }, statusCode: 503);
    }
});

// --- WEATHER (REAL-TIME VIA PYTHON) ---
app.MapGet("/api/weather", async (HttpRequest req, IHttpClientFactory clientFactory) => {
    var http = clientFactory.CreateClient();

    // Accept optional lat & lon as query parameters (e.g. /api/weather?lat=13.08&lon=80.27)
    double lat = 13.0827, lon = 80.2707; // defaults (Chennai)
    try {
        if (req.Query.ContainsKey("lat") && double.TryParse(req.Query["lat"], out var qlat)) lat = qlat;
        if (req.Query.ContainsKey("lon") && double.TryParse(req.Query["lon"], out var qlon)) lon = qlon;
    } catch {
        // ignore and use defaults
    }

    var payload = new { latitude = lat, longitude = lon };
    var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

    try {
        // Call Python Microservice
        var response = await http.PostAsync($"{aiServiceUrl}/weather_details", content);

        if (response.IsSuccessStatusCode) {
            // Pass Python's JSON directly to Frontend
            var json = await response.Content.ReadAsStringAsync();
            return Results.Content(json, "application/json");
        }
    } catch {
        Console.WriteLine("Python Service 5001 Not Reachable");
    }

    // Fallback if Python is offline
    return Results.Ok(new {
        current = new { temperature = 0, condition = "Service Offline", humidity = 0, wind_speed = 0 },
        prediction = new { status = "Unknown", message = "AI Model is offline.", rain_prob = 0.0 }
    });
});

// --- ROUTE OPTIMIZATION ---
app.MapPost("/api/optimize", async (RouteRequest req, IHttpClientFactory clientFactory) => {
    var http = clientFactory.CreateClient();
    http.DefaultRequestHeaders.Add("User-Agent", "ClimaRouteApp/1.0");

    async Task<Coord?> Geocode(string q) {
        try {
            if (q.Contains(",")) {
                var parts = q.Split(',');
                if (parts.Length >= 2) {
                    var latStr = parts[0].Trim();
                    var lonStr = parts[1].Trim();
                    if (double.TryParse(latStr, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out double lat) &&
                        double.TryParse(lonStr, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out double lon))
                        return new Coord { Lat = lat, Lon = lon };
                }
            }
            var json = await http.GetStringAsync($"https://nominatim.openstreetmap.org/search?q={Uri.EscapeDataString(q)}&format=json&limit=1");
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.GetArrayLength() > 0) {
                var item = doc.RootElement[0];
                return new Coord { Lat = double.Parse(item.GetProperty("lat").GetString()!, System.Globalization.CultureInfo.InvariantCulture), Lon = double.Parse(item.GetProperty("lon").GetString()!, System.Globalization.CultureInfo.InvariantCulture) };
            }
            return null;
        } catch { return null; }
    }

    double HaversineDistance(double lat1, double lon1, double lat2, double lon2) {
        double R = 6371; // km
        double dLat = (lat2 - lat1) * Math.PI / 180;
        double dLon = (lon2 - lon1) * Math.PI / 180;
        double a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) + Math.Cos(lat1 * Math.PI / 180) * Math.Cos(lat2 * Math.PI / 180) * Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        double c = 2 * Math.Asin(Math.Sqrt(a));
        return R * c; // km
    }

    var start = await Geocode(req.Origin);
    var end = await Geocode(req.Destination);
    if (start == null || end == null) return Results.BadRequest("Location not found.");

    string url = $"http://router.project-osrm.org/route/v1/driving/{start.Lon},{start.Lat};{end.Lon},{end.Lat}?alternatives=true&overview=full&geometries=geojson";
    var response = await http.GetAsync(url);

    var alternatives = new List<object>();
    int idCounter = 0;

    if (response.IsSuccessStatusCode) {
        var osrmData = JsonSerializer.Deserialize<OsrmResponse>(await response.Content.ReadAsStringAsync());
        if (osrmData?.routes != null) {
            foreach (var route in osrmData.routes) {
                double score = 80;
                double rainProb = 0;
                string condition = "Unknown";
                var midIndex = route.geometry.coordinates.Count / 2;
                var midPoint = route.geometry.coordinates[midIndex]; 

                try {
                    var payload = new { latitude = midPoint[1], longitude = midPoint[0] };
                    var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
                    var aiRes = await http.PostAsync($"{aiServiceUrl}/predict_score", content);
                    if (aiRes.IsSuccessStatusCode) {
                        var aiData = JsonSerializer.Deserialize<PythonResponse>(await aiRes.Content.ReadAsStringAsync());
                        score = aiData?.safety_score ?? 80;
                        rainProb = aiData?.rain_prob ?? 0;
                        condition = aiData?.condition ?? "Clear";
                    }
                } catch { }

                var roadPath = new List<double[]>();
                foreach (var p in route.geometry.coordinates) roadPath.Add(new double[] { p[1], p[0] });

                alternatives.Add(new {
                    id = idCounter++,
                    geometry = roadPath,
                    duration = route.duration,
                    distance = route.distance,
                    safetyScore = score,
                    rainProbability = rainProb,
                    condition = condition
                });
            }
        }
    }

    // Fallback if OSRM failed or returned nothing
    if (!alternatives.Any()) {
        double distanceMeters = HaversineDistance(start.Lat, start.Lon, end.Lat, end.Lon) * 1000;
        var straightLine = new List<double[]>() { new double[] { start.Lat, start.Lon }, new double[] { end.Lat, end.Lon } };
        alternatives.Add(new {
            id = idCounter++,
            geometry = straightLine,
            duration = distanceMeters / 15000 * 3600, // assume 15 km/h fallback
            distance = distanceMeters,
            safetyScore = 70,
            rainProbability = 0,
            condition = "Clear"
        });
    }

    return Results.Ok(new { startCoords = start, endCoords = end, alternatives = alternatives });
});

// --- AUTH, HISTORY, NOTIFICATIONS ---
// Signup endpoint: create user (role optional, defaults to 'user')
app.MapPost("/api/signup", async (AppDbContext db, UserCreate req) => {
    if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Name))
        return Results.BadRequest("Name and Email required");

    var exists = await db.Users.AnyAsync(u => u.Email.ToLower() == req.Email.ToLower());
    if (exists) return Results.Conflict("Email already registered");

    var pwd = req.Password;
    if (string.IsNullOrWhiteSpace(pwd)) {
        // generate a short random password and return it to caller
        pwd = Guid.NewGuid().ToString().Replace("-", "").Substring(0, 8);
    }

    var user = new User { Email = req.Email, Name = req.Name, Password = HashPassword(pwd), PlainPassword = pwd, Role = string.IsNullOrWhiteSpace(req.Role) ? "user" : req.Role };
    db.Users.Add(user);
    await db.SaveChangesAsync();
    return Results.Ok(new { token = "fake-jwt", user = new { email = user.Email, name = user.Name, role = user.Role } });
});

app.MapPost("/api/login", async (AppDbContext db, LoginRequest req) => {
    var hashed = HashPassword(req.Password ?? "");
    var user = await db.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == req.Email.ToLower() && u.Password == hashed);
    if (user == null) return Results.Unauthorized();
    return Results.Ok(new { token = "fake-jwt", user = new { user.Email, user.Name, user.Role } });
});

// GET all notifications (admin view - all types)
app.MapGet("/api/notifications", async (AppDbContext db) => Results.Ok(await db.Notifications.OrderByDescending(x => x.Id).Take(50).ToListAsync()));

// GET weather alerts only (user view - filtered)
app.MapGet("/api/notifications/weather", async (AppDbContext db) => {
    var weatherAlerts = await db.Notifications
        .Where(n => n.Type == "WEATHER_ALERT")
        .OrderByDescending(x => x.Id)
        .Take(50)
        .ToListAsync();
    return Results.Ok(weatherAlerts);
});

// POST notification - validates weather alerts
app.MapPost("/api/notifications", async (AppDbContext db, Notification n) => { 
    n.Timestamp = DateTime.UtcNow.ToString("o"); 
    db.Notifications.Add(n); 
    await db.SaveChangesAsync(); 
    return Results.Ok(n); 
});

// POST weather alert specifically (enforces type and validates severity)
app.MapPost("/api/notifications/weather", async (AppDbContext db, JsonElement body) => {
    var severity = body.TryGetProperty("severity", out var sev) ? sev.GetString() : null;
    var message = body.TryGetProperty("message", out var msg) ? msg.GetString() : null;
    var userEmail = body.TryGetProperty("userEmail", out var ue) ? ue.GetString() : null;
    
    // Validate severity - only HEAVY_RAIN or STORM allowed
    if (string.IsNullOrEmpty(severity) || (severity != "HEAVY_RAIN" && severity != "STORM")) {
        return Results.BadRequest(new { error = "Invalid severity. Must be HEAVY_RAIN or STORM" });
    }
    
    if (string.IsNullOrEmpty(message)) {
        return Results.BadRequest(new { error = "Message is required" });
    }
    
    var notification = new Notification {
        Type = "WEATHER_ALERT",
        Severity = severity,
        Category = "Critical",
        Title = severity == "STORM" ? "⛈️ Storm Warning" : "🌧️ Heavy Rain Alert",
        Description = message,
        Timestamp = DateTime.UtcNow.ToString("o"),
        UserEmail = userEmail
    };
    
    db.Notifications.Add(notification);
    await db.SaveChangesAsync();
    Console.WriteLine($"Weather alert created: {severity} - {message}");
    return Results.Ok(notification);
});

// GET system alerts only (when status is abnormal)
app.MapGet("/api/notifications/system", async (AppDbContext db) => {
    var systemAlerts = await db.Notifications
        .Where(n => n.Type == "SYSTEM_ALERT")
        .OrderByDescending(x => x.Id)
        .Take(50)
        .ToListAsync();
    return Results.Ok(systemAlerts);
});

// POST system alert (for abnormal system status)
app.MapPost("/api/notifications/system", async (AppDbContext db, JsonElement body) => {
    var severity = body.TryGetProperty("severity", out var sev) ? sev.GetString() : "ABNORMAL";
    var message = body.TryGetProperty("message", out var msg) ? msg.GetString() : null;
    var userEmail = body.TryGetProperty("userEmail", out var ue) ? ue.GetString() : null;
    
    // Validate severity - only ABNORMAL, SOS, or IDLE_ALERT allowed
    var validSeverities = new[] { "ABNORMAL", "SOS", "IDLE_ALERT", "EMERGENCY" };
    if (string.IsNullOrEmpty(severity) || !validSeverities.Contains(severity)) {
        severity = "ABNORMAL";
    }
    
    if (string.IsNullOrEmpty(message)) {
        return Results.BadRequest(new { error = "Message is required" });
    }
    
    var notification = new Notification {
        Type = "SYSTEM_ALERT",
        Severity = severity,
        Category = "Critical",
        Title = severity == "SOS" ? "🚨 SOS Alert" : severity == "IDLE_ALERT" ? "⏱️ Idle Alert" : "⚠️ System Alert",
        Description = message,
        Timestamp = DateTime.UtcNow.ToString("o"),
        UserEmail = userEmail
    };
    
    db.Notifications.Add(notification);
    await db.SaveChangesAsync();
    Console.WriteLine($"System alert created: {severity} - {message}");
    return Results.Ok(notification);
});

// GET user alerts (weather + system alerts combined) - SECURE: filters by user
app.MapGet("/api/notifications/user", async (AppDbContext db, HttpRequest req) => {
    var email = req.Query.ContainsKey("email") ? req.Query["email"].ToString().ToLower() : null;
    var role = req.Query.ContainsKey("role") ? req.Query["role"].ToString().ToLower() : "user";
    
    Console.WriteLine($"[NOTIFICATIONS] Request - email: {email ?? "null"}, role: {role}");
    
    // Build base query for weather and system alerts
    var query = db.Notifications
        .Where(n => n.Type == "WEATHER_ALERT" || n.Type == "SYSTEM_ALERT");
    
    // SECURITY: Non-admin users can ONLY see their own notifications
    // ALL notifications (weather + system) MUST have matching UserEmail
    if (role != "admin" && !string.IsNullOrEmpty(email)) {
        query = query.Where(n => 
            !string.IsNullOrEmpty(n.UserEmail) && n.UserEmail.ToLower() == email
        );
        Console.WriteLine($"[NOTIFICATIONS] Filtered for user: {email}");
    } else if (role == "admin") {
        Console.WriteLine($"[NOTIFICATIONS] Admin access - showing all notifications");
    } else {
        // No email provided and not admin - return empty for security
        Console.WriteLine($"[NOTIFICATIONS] No email provided - returning empty for security");
        return Results.Ok(new List<Notification>());
    }
    
    var userAlerts = await query
        .OrderByDescending(x => x.Id)
        .Take(50)
        .ToListAsync();
    
    Console.WriteLine($"[NOTIFICATIONS] Returning {userAlerts.Count} notifications");
    return Results.Ok(userAlerts);
});

// --- USER SETTINGS ---
app.MapGet("/api/settings", async (AppDbContext db, HttpRequest req) => {
    if (!req.Query.ContainsKey("email")) return Results.BadRequest("email query required");
    var email = req.Query["email"].ToString();
    var user = await db.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == email.ToLower());
    if (user == null) return Results.NotFound();
    var s = await db.UserSettings.FirstOrDefaultAsync(u => u.UserId == user.Id);
    if (s == null) return Results.Ok(new { TemperatureUnit = "C", DistanceUnit = "km", TimeFormat = "24", Language = "en-US" });
    return Results.Ok(s);
});

app.MapPut("/api/settings", async (AppDbContext db, HttpRequest req, SettingsRequest body) => {
    if (!req.Query.ContainsKey("email")) return Results.BadRequest("email query required");
    var email = req.Query["email"].ToString();
    var user = await db.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == email.ToLower());
    if (user == null) return Results.NotFound();
    var s = await db.UserSettings.FirstOrDefaultAsync(u => u.UserId == user.Id);
    if (s == null) {
        s = new UserSettings { UserId = user.Id, TemperatureUnit = body.TemperatureUnit ?? "C", DistanceUnit = body.DistanceUnit ?? "km", TimeFormat = body.TimeFormat ?? "24", Language = body.Language ?? "en-US", UpdatedAt = DateTime.UtcNow };
        db.UserSettings.Add(s);
    } else {
        s.TemperatureUnit = body.TemperatureUnit ?? s.TemperatureUnit;
        s.DistanceUnit = body.DistanceUnit ?? s.DistanceUnit;
        s.TimeFormat = body.TimeFormat ?? s.TimeFormat;
        s.Language = body.Language ?? s.Language;
        s.UpdatedAt = DateTime.UtcNow;
    }
    await db.SaveChangesAsync();
    return Results.Ok(s);
});

app.MapGet("/api/history", async (AppDbContext db, HttpRequest req) => {
    var email = req.Query.ContainsKey("email") ? req.Query["email"].ToString().ToLower() : null;
    var role = req.Query.ContainsKey("role") ? req.Query["role"].ToString().ToLower() : "user";
    
    Console.WriteLine($"[HISTORY] Request - email: {email ?? "null"}, role: {role}");
    
    // First load users into memory for case-insensitive lookup
    var users = await db.Users.ToListAsync();
    
    // Build query with user filtering
    IQueryable<DeliveryHistory> query = db.Histories;
    
    // SECURITY: Non-admin users can ONLY see their own history
    if (role != "admin" && !string.IsNullOrEmpty(email)) {
        query = query.Where(h => !string.IsNullOrEmpty(h.DriverEmail) && h.DriverEmail.ToLower() == email);
        Console.WriteLine($"[HISTORY] Filtered for user: {email}");
    } else if (role == "admin") {
        Console.WriteLine($"[HISTORY] Admin access - showing all history");
    } else {
        // No email provided and not admin - return empty for security
        Console.WriteLine($"[HISTORY] No email provided - returning empty");
        return Results.Ok(new List<object>());
    }
    
    var histories = await query.OrderByDescending(h => h.Id).ToListAsync();
    
    var list = histories.Select(h => {
        // Case-insensitive email lookup
        var user = users.FirstOrDefault(u => u.Email.ToLower() == (h.DriverEmail ?? "").ToLower());
        return new {
            id = h.Id,
            routeId = h.RouteId,
            date = h.Date,
            startTime = h.StartTime,
            endTime = h.EndTime,
            origin = h.Origin,
            destination = h.Destination,
            driverName = user?.Name ?? h.DriverEmail ?? "Unknown",
            weather = h.Weather,
            weatherCondition = h.WeatherCondition,
            distance = h.Distance,
            duration = h.Duration,
            status = h.Status,
            driverEmail = h.DriverEmail,
            originLat = h.OriginLat,
            originLon = h.OriginLon,
            destinationLat = h.DestinationLat,
            destinationLon = h.DestinationLon,
            currentLat = h.CurrentLat,
            currentLon = h.CurrentLon,
            eta = h.Eta,
            speed = h.Speed,
            temperature = h.Temperature,
            humidity = h.Humidity,
            windSpeed = h.WindSpeed,
            rainProbability = h.RainProbability,
            safetyScore = h.SafetyScore,
            notes = h.Notes,
            createdAt = h.CreatedAt
        };
    }).ToList();

    Console.WriteLine($"[HISTORY] Returning {list.Count} records");
    return Results.Ok(list);
});
app.MapPost("/api/history", async (AppDbContext db, SaveDeliveryHistoryRequest req) => { 
    try {
        // Validate user exists before accepting request
        if (string.IsNullOrEmpty(req.DriverEmail)) return Results.BadRequest("Driver email is required");
        var userExists = await db.Users.AnyAsync(u => u.Email.ToLower() == req.DriverEmail.ToLower());
        if (!userExists) return Results.Unauthorized();

        // --- ENFORCE SINGLE ACTIVE NAVIGATION ---
        var activeTrips = await db.Histories
            .Where(h => h.DriverEmail.ToLower() == req.DriverEmail.ToLower() && h.Status.ToLower() == "inprogress")
            .ToListAsync();
        foreach (var active in activeTrips)
        {
            active.Status = "Cancelled";
            active.Notes = "New navigation started";
        }
        if (activeTrips.Count > 0) await db.SaveChangesAsync();

        // Create new trip with InProgress status
        var trip = new DeliveryHistory {
            RouteId = req.RouteId,
            Date = req.Date,
            StartTime = req.StartTime,
            EndTime = req.EndTime,
            Origin = req.Origin,
            Destination = req.Destination,
            OriginLat = req.OriginLat,
            OriginLon = req.OriginLon,
            DestinationLat = req.DestinationLat,
            DestinationLon = req.DestinationLon,
            CurrentLat = req.OriginLat,
            CurrentLon = req.OriginLon,
            Eta = req.Eta,
            Speed = req.Speed,
            Weather = req.Weather,
            WeatherCondition = req.WeatherCondition,
            Temperature = req.Temperature,
            Humidity = req.Humidity,
            WindSpeed = req.WindSpeed,
            RainProbability = req.RainProbability,
            SafetyScore = req.SafetyScore,
            Distance = req.Distance,
            Duration = req.Duration,
            Status = "InProgress",
            DriverEmail = req.DriverEmail,
            Notes = req.Notes,
            CreatedAt = DateTime.Now
        };
        db.Histories.Add(trip); 
        await db.SaveChangesAsync(); 
        return Results.Ok(new { success = true, tripId = trip.Id }); 
    } catch (Exception ex) {
        return Results.BadRequest(new { error = ex.Message });
    }
});

// COMPLETE NAVIGATION - Dedicated endpoint for trip completion (STRICT: InProgress → Completed)
app.MapPost("/api/navigation/complete", async (AppDbContext db, JsonElement body) => {
    try {
        int? tripId = null;
        string? driverEmail = null;
        
        if (body.TryGetProperty("tripId", out var tid)) {
            tripId = tid.ValueKind == JsonValueKind.Number ? tid.GetInt32() : int.TryParse(tid.GetString(), out var parsed) ? parsed : (int?)null;
        }
        if (body.TryGetProperty("navigationId", out var nid)) {
            tripId = tripId ?? (nid.ValueKind == JsonValueKind.Number ? nid.GetInt32() : int.TryParse(nid.GetString(), out var parsed) ? parsed : (int?)null);
        }
        if (body.TryGetProperty("driverEmail", out var de)) {
            driverEmail = de.GetString();
        }
        
        DeliveryHistory? trip = null;
        
        // Find trip by ID first
        if (tripId.HasValue && tripId.Value > 0) {
            trip = await db.Histories.FindAsync(tripId.Value);
        }
        
        // Fallback: Find latest InProgress trip for this driver
        if (trip == null && !string.IsNullOrEmpty(driverEmail)) {
            trip = await db.Histories
                .Where(h => h.DriverEmail != null && h.DriverEmail.ToLower() == driverEmail.ToLower())
                .Where(h => h.Status != null && h.Status.ToLower() == "inprogress")
                .OrderByDescending(h => h.CreatedAt)
                .ThenByDescending(h => h.Id)
                .FirstOrDefaultAsync();
        }
        
        if (trip == null) {
            Console.WriteLine($"[Complete] Trip not found: tripId={tripId}, driverEmail={driverEmail}");
            return Results.NotFound(new { error = "Trip not found", tripId, driverEmail });
        }
        
        // Validate: Only InProgress trips can be completed
        var currentStatus = (trip.Status ?? "").ToLower();
        if (currentStatus == "completed") {
            Console.WriteLine($"[Complete] Trip {trip.Id} already completed");
            return Results.Ok(new { success = true, status = "Completed", message = "Trip was already completed", tripId = trip.Id });
        }
        if (currentStatus != "inprogress" && currentStatus != "paused") {
            Console.WriteLine($"[Complete] Cannot complete trip {trip.Id} with status {trip.Status}");
            return Results.BadRequest(new { error = $"Cannot complete trip with status: {trip.Status}", currentStatus = trip.Status });
        }
        
        // Update trip to Completed
        trip.Status = "Completed";
        trip.EndTime = DateTime.Now.ToLocalTime().ToString("HH:mm");
        trip.Speed = 0; // Trip ended
        
        // Update optional fields from request
        if (body.TryGetProperty("endTime", out var et)) trip.EndTime = et.GetString() ?? trip.EndTime;
        if (body.TryGetProperty("currentLat", out var cl) && cl.ValueKind == JsonValueKind.Number) trip.CurrentLat = cl.GetDouble();
        if (body.TryGetProperty("currentLon", out var co) && co.ValueKind == JsonValueKind.Number) trip.CurrentLon = co.GetDouble();
        
        await db.SaveChangesAsync();
        Console.WriteLine($"[Complete] Trip {trip.Id} completed successfully. Status={trip.Status}, EndTime={trip.EndTime}");
        
        return Results.Ok(new { 
            success = true, 
            status = "Completed",
            tripId = trip.Id,
            endTime = trip.EndTime,
            message = "Trip completed successfully"
        });
    } catch (Exception ex) {
        Console.WriteLine($"[Complete] Error: {ex.Message}");
        return Results.BadRequest(new { error = ex.Message });
    }
});

// Update an existing history (e.g., real-time location/status updates) - with ownership check
app.MapPut("/api/history/{id}", async (AppDbContext db, int id, HttpRequest req, JsonElement body) => {
    var email = req.Query.ContainsKey("email") ? req.Query["email"].ToString().ToLower() : null;
    var role = req.Query.ContainsKey("role") ? req.Query["role"].ToString().ToLower() : "user";
    
    var trip = await db.Histories.FindAsync(id);
    if (trip == null) return Results.NotFound();
    
    // SECURITY: Non-admin users can ONLY update their own trips
    if (role != "admin" && !string.IsNullOrEmpty(email)) {
        if (string.IsNullOrEmpty(trip.DriverEmail) || trip.DriverEmail.ToLower() != email) {
            Console.WriteLine($"[HISTORY PUT] Access denied - user {email} cannot update trip {id} owned by {trip.DriverEmail}");
            return Results.Unauthorized();
        }
    } else if (role != "admin") {
        Console.WriteLine($"[HISTORY PUT] Access denied - no email provided for non-admin");
        return Results.Unauthorized();
    }
    
    try {
        if (body.TryGetProperty("currentLat", out var cl)) trip.CurrentLat = cl.GetDouble();
        if (body.TryGetProperty("currentLon", out var co)) trip.CurrentLon = co.GetDouble();
        if (body.TryGetProperty("eta", out var e)) trip.Eta = e.GetString();
        if (body.TryGetProperty("speed", out var s)) trip.Speed = s.GetDouble();
        if (body.TryGetProperty("status", out var st)) trip.Status = st.GetString() ?? trip.Status;
        if (body.TryGetProperty("tripStatus", out var ts)) trip.Status = ts.GetString() ?? trip.Status;
        if (body.TryGetProperty("endTime", out var et)) trip.EndTime = et.GetString() ?? trip.EndTime;
        if (body.TryGetProperty("completedAt", out var ca)) trip.EndTime = ca.GetString() != null ? DateTime.Parse(ca.GetString()!).ToLocalTime().ToString("HH:mm") : trip.EndTime;
        if (body.TryGetProperty("destinationLat", out var dl)) trip.DestinationLat = dl.GetDouble();
        if (body.TryGetProperty("destinationLon", out var dlon)) trip.DestinationLon = dlon.GetDouble();
        if (body.TryGetProperty("weather", out var w)) trip.Weather = w.GetString() ?? trip.Weather;
        if (body.TryGetProperty("weatherCondition", out var wc)) trip.WeatherCondition = wc.GetString() ?? trip.WeatherCondition;
        if (body.TryGetProperty("temperature", out var t)) trip.Temperature = t.GetDouble();
        if (body.TryGetProperty("humidity", out var h)) trip.Humidity = h.ValueKind == JsonValueKind.Number ? h.GetInt32() : trip.Humidity;
        if (body.TryGetProperty("windSpeed", out var ws)) trip.WindSpeed = ws.GetDouble();
        if (body.TryGetProperty("rainProbability", out var rp)) trip.RainProbability = rp.GetDouble();
        if (body.TryGetProperty("safetyScore", out var ss)) trip.SafetyScore = ss.GetString() ?? trip.SafetyScore;
        await db.SaveChangesAsync();
        Console.WriteLine($"Updated history {id}: Status={trip.Status}, EndTime={trip.EndTime}");
        return Results.Ok(new { success = true, status = trip.Status, endTime = trip.EndTime });
    } catch (Exception ex) {
        Console.WriteLine($"Error updating history {id}: {ex.Message}");
        return Results.BadRequest(new { error = ex.Message });
    }
});

// --- USERS (Admin) ---
app.MapGet("/api/users", async (AppDbContext db) => {
    var list = await db.Users.Select(u => new { id = u.Id, email = u.Email, name = u.Name, phone = u.Phone ?? "", vehicleId = u.VehicleId ?? "", role = u.Role, status = (string.IsNullOrEmpty(u.Status) ? "Active" : u.Status), password = u.PlainPassword }).ToListAsync();
    return Results.Ok(list);
});

// Delete all data for a specific user email (Admin cleanup)
app.MapDelete("/api/users/cleanup/{email}", async (AppDbContext db, string email) => {
    var emailLower = email.ToLower();
    
    // Delete from SosAlerts
    var sosAlerts = await db.SosAlerts.Where(s => s.DriverEmail.ToLower() == emailLower).ToListAsync();
    db.SosAlerts.RemoveRange(sosAlerts);
    
    // Delete from Notifications that mention this email
    var notifications = await db.Notifications.Where(n => 
        n.Description.Contains(email) || 
        n.Title.Contains(email) ||
        (n.UserEmail != null && n.UserEmail.ToLower() == emailLower)
    ).ToListAsync();
    db.Notifications.RemoveRange(notifications);
    
    // Delete from Histories
    var histories = await db.Histories.Where(h => h.DriverEmail != null && h.DriverEmail.ToLower() == emailLower).ToListAsync();
    db.Histories.RemoveRange(histories);
    
    // Delete the user
    var user = await db.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == emailLower);
    if (user != null) db.Users.Remove(user);
    
    await db.SaveChangesAsync();
    
    return Results.Ok(new { 
        success = true, 
        deleted = new {
            sosAlerts = sosAlerts.Count,
            notifications = notifications.Count,
            histories = histories.Count,
            user = user != null ? 1 : 0
        }
    });
});

app.MapDelete("/api/users/{id}", async (AppDbContext db, int id) => {
    var user = await db.Users.FindAsync(id);
    if (user == null) return Results.NotFound();
    db.Users.Remove(user);
    await db.SaveChangesAsync();
    return Results.Ok(new { success = true });
});

// Update user (Admin)
app.MapPut("/api/users/{id}", async (AppDbContext db, int id, System.Text.Json.JsonElement body) => {
    var user = await db.Users.FindAsync(id);
    if (user == null) return Results.NotFound();

    if (body.TryGetProperty("email", out var e) || body.TryGetProperty("Email", out e)) user.Email = e.GetString() ?? user.Email;
    if (body.TryGetProperty("name", out var n) || body.TryGetProperty("Name", out n)) user.Name = n.GetString() ?? user.Name;
    if (body.TryGetProperty("phone", out var p) || body.TryGetProperty("Phone", out p)) user.Phone = p.GetString() ?? user.Phone;
    if (body.TryGetProperty("password", out var pwd) || body.TryGetProperty("Password", out pwd)) {
        var newPwd = pwd.GetString();
        if (!string.IsNullOrWhiteSpace(newPwd)) {
            user.Password = HashPassword(newPwd);
            user.PlainPassword = newPwd;
        }
    }
    if (body.TryGetProperty("role", out var r) || body.TryGetProperty("Role", out r)) user.Role = r.GetString() ?? user.Role;
    if (body.TryGetProperty("status", out var s) || body.TryGetProperty("Status", out s)) user.Status = s.GetString() ?? user.Status;

    await db.SaveChangesAsync();
    return Results.Ok(new { success = true, user = new { id = user.Id, email = user.Email, name = user.Name, phone = user.Phone, role = user.Role, status = user.Status } });
});

// Fallback update endpoint using POST to avoid verb routing conflicts in some environments
app.MapPost("/api/users/{id}/update", async (AppDbContext db, int id, System.Text.Json.JsonElement body) => {
    var user = await db.Users.FindAsync(id);
    if (user == null) return Results.NotFound();

    if (body.TryGetProperty("email", out var e) || body.TryGetProperty("Email", out e)) user.Email = e.GetString() ?? user.Email;
    if (body.TryGetProperty("name", out var n) || body.TryGetProperty("Name", out n)) user.Name = n.GetString() ?? user.Name;
    if (body.TryGetProperty("phone", out var p) || body.TryGetProperty("Phone", out p)) user.Phone = p.GetString() ?? user.Phone;
    if (body.TryGetProperty("vehicleId", out var v) || body.TryGetProperty("VehicleId", out v)) user.VehicleId = v.GetString() ?? user.VehicleId;
    if (body.TryGetProperty("password", out var pwd) || body.TryGetProperty("Password", out pwd)) {
        var newPwd = pwd.GetString();
        if (!string.IsNullOrWhiteSpace(newPwd)) {
            user.Password = HashPassword(newPwd);
            user.PlainPassword = newPwd;
        }
    }
    if (body.TryGetProperty("role", out var r) || body.TryGetProperty("Role", out r)) user.Role = r.GetString() ?? user.Role;
    if (body.TryGetProperty("status", out var s) || body.TryGetProperty("Status", out s)) user.Status = s.GetString() ?? user.Status;

    await db.SaveChangesAsync();
    return Results.Ok(new { success = true, user = new { id = user.Id, email = user.Email, name = user.Name, phone = user.Phone, vehicleId = user.VehicleId, role = user.Role, status = user.Status } });
});

// --- ADMIN DASHBOARD STATS ---
app.MapGet("/api/admin/stats", async (AppDbContext db) => {
    try {
        // Load ALL users from database
        var users = await db.Users.ToListAsync();
        var histories = await db.Histories.ToListAsync();

        Console.WriteLine($"[Dashboard Stats] Found {users.Count} users, {histories.Count} history records");

        // Get completed deliveries grouped by driver email (case-insensitive)
        var completedByEmail = histories
            .Where(h => !string.IsNullOrEmpty(h.Status) && h.Status.ToLower() == "completed" && !string.IsNullOrEmpty(h.DriverEmail))
            .GroupBy(h => h.DriverEmail!.ToLower())
            .ToDictionary(g => g.Key, g => g.Count());

        // Build delivery count for ALL users (including those with 0 completions)
        // This ensures every user appears in the bar chart
        var userDeliveries = users
            .Select(u => {
                var emailKey = (u.Email ?? "").ToLower();
                var completedCount = completedByEmail.ContainsKey(emailKey) ? completedByEmail[emailKey] : 0;
                return new {
                    user = !string.IsNullOrEmpty(u.Name) ? u.Name : u.Email,
                    email = u.Email,
                    count = completedCount,
                    role = u.Role ?? "user"
                };
            })
            .OrderByDescending(x => x.count)
            .ThenBy(x => x.user)
            .ToList();

        Console.WriteLine($"[Dashboard Stats] User deliveries data: {userDeliveries.Count} entries");

        // ACTIVE FLEET: Use SAME logic as Fleet Monitoring - InProgress trips, deduplicated per driver
        // Step 1: Get all InProgress trips
        var inProgressTrips = histories
            .Where(h => !string.IsNullOrEmpty(h.Status) && h.Status.ToLower() == "inprogress")
            .ToList();

        // Step 2: Group by driver and count only ONE per driver (same as Fleet Monitoring)
        var activeFleetByDriver = inProgressTrips
            .Where(h => !string.IsNullOrEmpty(h.DriverEmail))
            .GroupBy(h => h.DriverEmail!.ToLower())
            .Select(g => g.OrderByDescending(h => h.CreatedAt).ThenByDescending(h => h.Id).First())
            .ToList();

        var activeFleet = activeFleetByDriver.Count;
        Console.WriteLine($"[Dashboard Stats] Active fleet (deduplicated): {activeFleet}");

        // Active alerts = count of SOS alerts that are currently active (IsActive == true)
        var activeAlerts = await db.SosAlerts.CountAsync(a => a.IsActive);

        // Total drivers = users with role "user" (not admin)
        var totalDrivers = users.Count(u => !string.IsNullOrEmpty(u.Role) && u.Role.ToLower() == "user");
        
        // Total users = ALL users in system (admin + drivers)
        var totalUsers = users.Count;
        
        Console.WriteLine($"[Dashboard Stats] Total users: {totalUsers}, Total drivers: {totalDrivers}, Active alerts: {activeAlerts}");

        var systemHealth = (histories.Count > 0) ? "Good" : "No Data";

        return Results.Ok(new {
            activeFleet,
            activeAlerts,
            totalDrivers,
            totalUsers,
            systemHealth,
            weeklyVolume = userDeliveries
        });
    }
    catch (Exception ex)
    {
        Console.WriteLine("/api/admin/stats error: " + ex.ToString());
        return Results.Ok(new {
            activeFleet = 0,
            activeAlerts = 0,
            totalDrivers = 0,
            totalUsers = 0,
            systemHealth = "Error",
            weeklyVolume = new List<object>()
        });
    }
});

// --- SOS ALERTS (DB-Driven System) ---

// GET all alerts (admin)
app.MapGet("/api/sos/all", async (AppDbContext db) => {
    var alerts = await db.SosAlerts.OrderByDescending(a => a.CreatedAt).ToListAsync();
    return Results.Ok(alerts.Select(a => new {
        id = a.Id,
        vehicleId = a.VehicleId,
        driverEmail = a.DriverEmail,
        driverName = a.DriverName,
        type = a.Type,
        location = a.Location,
        isActive = a.IsActive,
        createdAt = a.CreatedAt,
        resolvedAt = a.ResolvedAt
    }));
});

// GET active SOS for a specific driver
app.MapGet("/api/sos/active/{driverEmail}", async (AppDbContext db, string driverEmail) => {
    var activeAlert = await db.SosAlerts
        .Where(a => a.DriverEmail.ToLower() == driverEmail.ToLower() && a.IsActive)
        .OrderByDescending(a => a.CreatedAt)
        .FirstOrDefaultAsync();
    
    if (activeAlert == null) {
        return Results.Ok(new { hasActive = false, alert = (object?)null });
    }
    
    return Results.Ok(new { 
        hasActive = true, 
        alert = new {
            id = activeAlert.Id,
            vehicleId = activeAlert.VehicleId,
            driverEmail = activeAlert.DriverEmail,
            driverName = activeAlert.DriverName,
            type = activeAlert.Type,
            location = activeAlert.Location,
            isActive = activeAlert.IsActive,
            createdAt = activeAlert.CreatedAt
        }
    });
});

// CREATE new SOS alert
app.MapPost("/api/sos/create", async (AppDbContext db, SosCreateRequest req) => {
    // Validate driver exists
    var user = await db.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == req.DriverEmail.ToLower());
    if (user == null) return Results.BadRequest("Driver not found");
    
    // Check if there's already an active alert for this driver
    var existingActive = await db.SosAlerts
        .AnyAsync(a => a.DriverEmail.ToLower() == req.DriverEmail.ToLower() && a.IsActive);
    
    if (existingActive) {
        return Results.BadRequest("An active SOS already exists for this driver");
    }
    
    var now = DateTime.UtcNow;
    var alert = new SosAlert {
        VehicleId = req.VehicleId ?? user.VehicleId ?? "UNKNOWN",
        DriverEmail = req.DriverEmail,
        DriverName = user.Name ?? req.DriverEmail,
        Type = req.Type,
        Location = req.Location,
        Time = now.ToString("HH:mm"),  // Required by DB schema
        IsActive = true,
        CreatedAt = now,
        ResolvedAt = null
    };
    
    db.SosAlerts.Add(alert);
    await db.SaveChangesAsync();
    
    return Results.Ok(new { 
        success = true, 
        id = alert.Id, 
        message = "SOS Alert created successfully" 
    });
});

// RESOLVE SOS alert
app.MapPost("/api/sos/resolve/{sosId}", async (AppDbContext db, int sosId) => {
    var alert = await db.SosAlerts.FindAsync(sosId);
    if (alert == null) return Results.NotFound("Alert not found");
    
    alert.IsActive = false;
    alert.ResolvedAt = DateTime.UtcNow;
    await db.SaveChangesAsync();
    
    return Results.Ok(new { 
        success = true, 
        message = "SOS Alert resolved successfully",
        resolvedAt = alert.ResolvedAt
    });
});

// Legacy endpoints for backward compatibility
app.MapGet("/api/alerts", async (AppDbContext db) => {
    var alerts = await db.SosAlerts.OrderByDescending(a => a.CreatedAt).ToListAsync();
    return Results.Ok(alerts.Select(a => new {
        id = a.Id,
        vehicleId = a.VehicleId,
        driverEmail = a.DriverEmail,
        driverName = a.DriverName,
        type = a.Type,
        location = a.Location,
        time = a.CreatedAt.ToLocalTime().ToString("dd MMM yyyy, hh:mm tt"),
        isActive = a.IsActive,
        createdAt = a.CreatedAt.ToLocalTime(),
        resolvedAt = a.ResolvedAt?.ToLocalTime()
    }));
});

app.MapPost("/api/alerts", async (AppDbContext db, SosAlert req) => {
    // Validate user exists before accepting request
    if (string.IsNullOrEmpty(req.DriverEmail)) return Results.BadRequest("Driver email is required");
    var user = await db.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == req.DriverEmail.ToLower());
    if (user == null) return Results.Unauthorized();

    var now = DateTime.UtcNow;
    req.DriverName = user.Name ?? req.DriverEmail;
    req.VehicleId = string.IsNullOrEmpty(req.VehicleId) ? (user.VehicleId ?? "UNKNOWN") : req.VehicleId;
    req.Time = now.ToString("HH:mm");  // Required by DB schema
    req.CreatedAt = now;
    req.IsActive = true;
    db.SosAlerts.Add(req);
    await db.SaveChangesAsync();
    return Results.Ok(new { id = req.Id, message = "Alert triggered" });
});

app.MapPut("/api/alerts/{id}", async (AppDbContext db, int id) => {
    var alert = await db.SosAlerts.FindAsync(id);
    if (alert == null) return Results.NotFound();
    alert.IsActive = false;
    alert.ResolvedAt = DateTime.UtcNow;
    await db.SaveChangesAsync();
    return Results.Ok(new { message = "Alert closed" });
});

// --- FLEET MONITORING ---
app.MapGet("/api/fleet/locations", async (AppDbContext db, HttpRequest req) => {
    var email = req.Query.ContainsKey("email") ? req.Query["email"].ToString().ToLower() : null;
    var role = req.Query.ContainsKey("role") ? req.Query["role"].ToString().ToLower() : "user";
    
    Console.WriteLine($"[FLEET/LOCATIONS] Request - email: {email ?? "null"}, role: {role}");
    
    // Build query for active in-progress histories
    IQueryable<DeliveryHistory> query = db.Histories
        .Where(h => !string.IsNullOrEmpty(h.Status) && h.Status.ToLower() != "completed");
    
    // SECURITY: Non-admin users can ONLY see their own fleet
    if (role != "admin" && !string.IsNullOrEmpty(email)) {
        query = query.Where(h => !string.IsNullOrEmpty(h.DriverEmail) && h.DriverEmail.ToLower() == email);
        Console.WriteLine($"[FLEET/LOCATIONS] Filtered for user: {email}");
    } else if (role == "admin") {
        Console.WriteLine($"[FLEET/LOCATIONS] Admin access - showing all fleet");
    } else {
        Console.WriteLine($"[FLEET/LOCATIONS] No email provided - returning empty");
        return Results.Ok(new List<object>());
    }
    
    var activeRoutes = await query.ToListAsync();

    var userIds = activeRoutes.Select(h => h.DriverEmail).Where(e => e != null).Distinct().ToList();
    var userLookup = await db.Users.Where(u => userIds.Contains(u.Email)).ToDictionaryAsync(u => u.Email, u => u.Name);

    var vehicles = activeRoutes.Select((h, idx) => new {
        id = h.Id.ToString(),
        vehicleId = (h.DriverEmail != null && userLookup.ContainsKey(h.DriverEmail)) ? userLookup[h.DriverEmail] : (string.IsNullOrEmpty(h.RouteId) ? $"FLT-{1000 + idx}" : h.RouteId),
        driverEmail = h.DriverEmail,
        driverName = (h.DriverEmail != null && userLookup.ContainsKey(h.DriverEmail)) ? userLookup[h.DriverEmail] : h.DriverEmail,
        lat = h.CurrentLat ?? (h.OriginLat ?? 13.0827) ,
        lon = h.CurrentLon ?? (h.OriginLon ?? 80.2707) ,
        heading = (idx % 4) switch { 0 => "North", 1 => "East", 2 => "South", _ => "West" },
        status = string.IsNullOrEmpty(h.Status) ? "Moving" : h.Status,
        origin = h.Origin,
        destination = h.Destination,
        distance = h.Distance,
        eta = h.Eta ?? "--"
    }).ToList();

    Console.WriteLine($"[FLEET/LOCATIONS] Returning {vehicles.Count} vehicles");
    return Results.Ok(vehicles);
});

app.MapGet("/api/fleet/route/{id}", async (AppDbContext db, int id) => {
    var route = await db.Histories.FindAsync(id);
    if (route == null) return Results.NotFound();
    
    return Results.Ok(new {
        id = route.Id,
        routeId = route.RouteId,
        driverEmail = route.DriverEmail,
        origin = route.Origin,
        destination = route.Destination,
        distance = route.Distance,
        status = route.Status,
        startTime = route.StartTime,
        eta = route.Eta ?? "--",
        currentLocation = new { lat = route.CurrentLat ?? route.OriginLat ?? 13.0827, lon = route.CurrentLon ?? route.OriginLon ?? 80.2707 }
    });
});

// --- REAL-TIME FLEET MONITORING WITH ROUTE GEOMETRY ---
app.MapGet("/api/fleet/realtime", async (AppDbContext db, HttpRequest req, IHttpClientFactory clientFactory) => {
    var email = req.Query.ContainsKey("email") ? req.Query["email"].ToString().ToLower() : null;
    var role = req.Query.ContainsKey("role") ? req.Query["role"].ToString().ToLower() : "user";
    
    Console.WriteLine($"[FLEET/REALTIME] Request - email: {email ?? "null"}, role: {role}");
    
    var http = clientFactory.CreateClient();
    http.DefaultRequestHeaders.Add("User-Agent", "ClimaRouteApp/1.0");
    
    // Build query for active in-progress trips
    IQueryable<DeliveryHistory> query = db.Histories
        .Where(h => !string.IsNullOrEmpty(h.Status) && h.Status.ToLower() != "completed");
    
    // SECURITY: Non-admin users can ONLY see their own fleet
    if (role != "admin" && !string.IsNullOrEmpty(email)) {
        query = query.Where(h => !string.IsNullOrEmpty(h.DriverEmail) && h.DriverEmail.ToLower() == email);
        Console.WriteLine($"[FLEET/REALTIME] Filtered for user: {email}");
    } else if (role == "admin") {
        Console.WriteLine($"[FLEET/REALTIME] Admin access - showing all fleet");
    } else {
        Console.WriteLine($"[FLEET/REALTIME] No email provided - returning empty");
        return Results.Ok(new List<object>());
    }
    
    var activeRoutes = await query.ToListAsync();

    var userIds = activeRoutes.Select(h => h.DriverEmail).Where(e => e != null).Distinct().ToList();
    var userLookup = await db.Users.Where(u => userIds.Contains(u.Email)).ToDictionaryAsync(u => u.Email, u => u.Name);

    var vehicles = new List<object>();
    
    foreach (var (h, idx) in activeRoutes.Select((h, idx) => (h, idx))) {
        var currentLat = h.CurrentLat ?? h.OriginLat ?? 13.0827;
        var currentLon = h.CurrentLon ?? h.OriginLon ?? 80.2707;
        var destLat = h.DestinationLat ?? 13.1;
        var destLon = h.DestinationLon ?? 80.3;
        
        // Fetch route geometry from OSRM
        List<double[]>? routeGeometry = null;
        try {
            var osrmUrl = $"http://router.project-osrm.org/route/v1/driving/{currentLon},{currentLat};{destLon},{destLat}?overview=full&geometries=geojson";
            var osrmResponse = await http.GetAsync(osrmUrl);
            if (osrmResponse.IsSuccessStatusCode) {
                var osrmData = await osrmResponse.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(osrmData);
                var routes = doc.RootElement.GetProperty("routes");
                if (routes.GetArrayLength() > 0) {
                    var coords = routes[0].GetProperty("geometry").GetProperty("coordinates");
                    routeGeometry = new List<double[]>();
                    foreach (var coord in coords.EnumerateArray()) {
                        var lon = coord[0].GetDouble();
                        var lat = coord[1].GetDouble();
                        routeGeometry.Add(new double[] { lat, lon });
                    }
                }
            }
        } catch (Exception ex) {
            Console.WriteLine($"OSRM Error for vehicle {h.Id}: {ex.Message}");
        }
        
        // Fallback to straight line if OSRM fails
        if (routeGeometry == null || routeGeometry.Count == 0) {
            routeGeometry = new List<double[]> {
                new double[] { currentLat, currentLon },
                new double[] { destLat, destLon }
            };
        }
        
        vehicles.Add(new {
            id = h.Id,
            vehicleId = h.RouteId ?? $"FLT-{1000 + idx}",
            driverEmail = h.DriverEmail,
            driverName = (h.DriverEmail != null && userLookup.ContainsKey(h.DriverEmail)) ? userLookup[h.DriverEmail] : h.DriverEmail,
            lat = currentLat,
            lon = currentLon,
            originLat = h.OriginLat ?? currentLat,
            originLon = h.OriginLon ?? currentLon,
            destLat = destLat,
            destLon = destLon,
            heading = (idx % 4) switch { 0 => "North", 1 => "East", 2 => "South", _ => "West" },
            status = string.IsNullOrEmpty(h.Status) ? "Moving" : h.Status,
            origin = h.Origin,
            destination = h.Destination,
            distance = h.Distance,
            eta = h.Eta ?? "--",
            speed = h.Speed ?? 0,
            routeGeometry = routeGeometry
        });
    }

    return Results.Ok(vehicles);
});

// --- ACTIVE FLEET MONITORING (STRICT: Only InProgress, Auto-Cancel Duplicates) ---
app.MapGet("/api/fleet/active", async (AppDbContext db, HttpRequest req, IHttpClientFactory clientFactory) => {
    var email = req.Query.ContainsKey("email") ? req.Query["email"].ToString().ToLower() : null;
    var role = req.Query.ContainsKey("role") ? req.Query["role"].ToString().ToLower() : "user";
    
    Console.WriteLine($"[FLEET/ACTIVE] Request - email: {email ?? "null"}, role: {role}");
    
    var http = clientFactory.CreateClient();
    http.DefaultRequestHeaders.Add("User-Agent", "ClimaRouteApp/1.0");
    
    // Step 1: Build query for InProgress trips ONLY
    IQueryable<DeliveryHistory> query = db.Histories
        .Where(h => h.Status != null && h.Status.ToLower() == "inprogress");
    
    // SECURITY: Non-admin users can ONLY see their own fleet
    if (role != "admin" && !string.IsNullOrEmpty(email)) {
        query = query.Where(h => !string.IsNullOrEmpty(h.DriverEmail) && h.DriverEmail.ToLower() == email);
        Console.WriteLine($"[FLEET/ACTIVE] Filtered for user: {email}");
    } else if (role == "admin") {
        Console.WriteLine($"[FLEET/ACTIVE] Admin access - showing all fleet");
    } else {
        Console.WriteLine($"[FLEET/ACTIVE] No email provided - returning empty");
        return Results.Ok(new List<object>());
    }
    
    var inProgressTrips = await query.ToListAsync();

    // Step 2: Group by driver and handle duplicates (CRITICAL: only ONE active per driver)
    var grouped = inProgressTrips
        .Where(h => !string.IsNullOrEmpty(h.DriverEmail))
        .GroupBy(h => h.DriverEmail!.ToLower())
        .ToList();

    var validFleets = new List<DeliveryHistory>();
    var toCancel = new List<DeliveryHistory>();

    foreach (var group in grouped) {
        if (group.Count() > 1) {
            // Multiple InProgress for same driver - keep only the latest
            var sorted = group.OrderByDescending(h => h.CreatedAt).ThenByDescending(h => h.Id).ToList();
            validFleets.Add(sorted.First()); // Keep newest
            toCancel.AddRange(sorted.Skip(1)); // Cancel all older ones
        } else {
            validFleets.Add(group.First());
        }
    }

    // Step 3: Auto-cancel older duplicates in DB (persist)
    if (toCancel.Any()) {
        foreach (var trip in toCancel) {
            trip.Status = "Cancelled";
        }
        await db.SaveChangesAsync();
        Console.WriteLine($"[Fleet Cleanup] Auto-cancelled {toCancel.Count} duplicate InProgress trips");
    }

    // Step 4: Get user lookup for driver info
    var userEmails = validFleets.Select(h => h.DriverEmail).Where(e => e != null).Distinct().ToList();
    var userLookup = await db.Users.Where(u => userEmails.Contains(u.Email)).ToDictionaryAsync(u => u.Email.ToLower(), u => u);

    // Helper: Reverse geocode location name
    async Task<string> GetLocationName(double lat, double lon) {
        try {
            var url = $"https://nominatim.openstreetmap.org/reverse?lat={lat}&lon={lon}&format=json";
            var response = await http.GetAsync(url);
            if (response.IsSuccessStatusCode) {
                var json = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(json);
                if (doc.RootElement.TryGetProperty("display_name", out var name)) {
                    var fullName = name.GetString() ?? "";
                    var parts = fullName.Split(',').Take(3).Select(p => p.Trim());
                    return string.Join(", ", parts);
                }
            }
        } catch (Exception ex) {
            Console.WriteLine($"Geocode error: {ex.Message}");
        }
        return "Location unavailable";
    }

    // Step 5: Build response with location names (NO raw coordinates in display)
    var vehicles = new List<object>();
    
    foreach (var (h, idx) in validFleets.Select((h, idx) => (h, idx))) {
        var currentLat = h.CurrentLat ?? h.OriginLat ?? 13.0827;
        var currentLon = h.CurrentLon ?? h.OriginLon ?? 80.2707;
        var destLat = h.DestinationLat ?? 13.1;
        var destLon = h.DestinationLon ?? 80.3;
        
        // Get user info
        var driverKey = (h.DriverEmail ?? "").ToLower();
        var user = userLookup.ContainsKey(driverKey) ? userLookup[driverKey] : null;
        
        // Reverse geocode current location
        var currentLocationName = await GetLocationName(currentLat, currentLon);
        
        // Fetch route geometry from OSRM
        List<double[]>? routeGeometry = null;
        try {
            var osrmUrl = $"http://router.project-osrm.org/route/v1/driving/{currentLon},{currentLat};{destLon},{destLat}?overview=full&geometries=geojson";
            var osrmResponse = await http.GetAsync(osrmUrl);
            if (osrmResponse.IsSuccessStatusCode) {
                var osrmData = await osrmResponse.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(osrmData);
                var routes = doc.RootElement.GetProperty("routes");
                if (routes.GetArrayLength() > 0) {
                    var coords = routes[0].GetProperty("geometry").GetProperty("coordinates");
                    routeGeometry = new List<double[]>();
                    foreach (var coord in coords.EnumerateArray()) {
                        var lon = coord[0].GetDouble();
                        var lat = coord[1].GetDouble();
                        routeGeometry.Add(new double[] { lat, lon });
                    }
                }
            }
        } catch (Exception ex) {
            Console.WriteLine($"OSRM Error for vehicle {h.Id}: {ex.Message}");
        }
        
        if (routeGeometry == null || routeGeometry.Count == 0) {
            routeGeometry = new List<double[]> {
                new double[] { currentLat, currentLon },
                new double[] { destLat, destLon }
            };
        }
        
        vehicles.Add(new {
            id = h.Id,
            vehicleId = user?.VehicleId ?? h.RouteId ?? $"FLT-{1000 + idx}",
            driverEmail = h.DriverEmail,
            driverName = user?.Name ?? h.DriverEmail ?? "Unknown Driver",
            lat = currentLat,
            lon = currentLon,
            originLat = h.OriginLat ?? currentLat,
            originLon = h.OriginLon ?? currentLon,
            destLat = destLat,
            destLon = destLon,
            status = "InProgress",
            origin = h.Origin ?? "Unknown",
            destination = h.Destination ?? "Unknown",
            distance = h.Distance ?? "N/A",
            eta = h.Eta ?? "Calculating...",
            speed = h.Speed ?? 0,
            currentLocationName = currentLocationName,
            lastUpdated = h.CreatedAt.ToString("yyyy-MM-dd HH:mm:ss"),
            routeGeometry = routeGeometry
        });
    }

    return Results.Ok(vehicles);
});

// --- UPDATE VEHICLE LOCATION (for real-time tracking) ---
app.MapPost("/api/fleet/update-location", async (AppDbContext db, UpdateLocationRequest req) => {
    try {
        var trip = await db.Histories.FindAsync(req.TripId);
        if (trip == null) return Results.NotFound(new { error = "Trip not found" });
        
        // Validate user associated with trip exists
        if (!string.IsNullOrEmpty(trip.DriverEmail)) {
            var userExists = await db.Users.AnyAsync(u => u.Email.ToLower() == trip.DriverEmail.ToLower());
            if (!userExists) return Results.Unauthorized();
        }
        
        trip.CurrentLat = req.Latitude;
        trip.CurrentLon = req.Longitude;
        trip.Speed = req.Speed;
        if (!string.IsNullOrEmpty(req.Eta)) trip.Eta = req.Eta;
        
        await db.SaveChangesAsync();
        return Results.Ok(new { success = true });
    } catch (Exception ex) {
        return Results.BadRequest(new { error = ex.Message });
    }
});

// --- WEATHER STORAGE & HISTORY ---
app.MapPost("/api/weather/save", async (AppDbContext db, SaveWeatherRequest req) => {
    var weather = new Weather 
    { 
        Temperature = req.Temperature, 
        Condition = req.Condition, 
        Humidity = req.Humidity, 
        WindSpeed = req.WindSpeed,
        RainProbability = req.RainProbability,
        SafetyScore = req.SafetyScore,
        RecordedAt = DateTime.Now,
        UserEmail = req.UserEmail
    };
    db.Weathers.Add(weather);
    await db.SaveChangesAsync();
    Console.WriteLine($"[WEATHER] Saved for user: {req.UserEmail ?? "anonymous"}");
    return Results.Ok(new { success = true, id = weather.Id });
});

app.MapGet("/api/weather/history", async (AppDbContext db, HttpRequest req) => {
    var email = req.Query.ContainsKey("email") ? req.Query["email"].ToString().ToLower() : null;
    var role = req.Query.ContainsKey("role") ? req.Query["role"].ToString().ToLower() : "user";
    
    Console.WriteLine($"[WEATHER HISTORY] Request - email: {email ?? "null"}, role: {role}");
    
    var query = db.Weathers.AsQueryable();
    
    // SECURITY: Non-admin users can ONLY see their own weather data
    if (role != "admin" && !string.IsNullOrEmpty(email)) {
        query = query.Where(w => !string.IsNullOrEmpty(w.UserEmail) && w.UserEmail.ToLower() == email);
        Console.WriteLine($"[WEATHER HISTORY] Filtered for user: {email}");
    } else if (role == "admin") {
        Console.WriteLine($"[WEATHER HISTORY] Admin access - showing all weather data");
    } else {
        // No email provided and not admin - return empty for security
        Console.WriteLine($"[WEATHER HISTORY] No email provided - returning empty");
        return Results.Ok(new List<object>());
    }
    
    var records = await query
        .OrderByDescending(w => w.RecordedAt)
        .Take(168) // Last 7 days * 24 hours
        .ToListAsync();
    
    Console.WriteLine($"[WEATHER HISTORY] Returning {records.Count} records");
    return Results.Ok(records.Select(w => new {
        w.Id,
        w.Temperature,
        w.Condition,
        w.Humidity,
        w.WindSpeed,
        w.RainProbability,
        w.SafetyScore,
        recordedAt = w.RecordedAt.ToString("yyyy-MM-dd HH:mm:ss")
    }).ToList());
});

// --- SOS TRACKING & BREAK MODE ---
app.MapPost("/api/sos/track-movement", async (AppDbContext db, SosTrackingRequest req) => {
    // Log vehicle movement for idle detection
    try {
        // Validate user exists
        if (string.IsNullOrEmpty(req.DriverEmail)) return Results.BadRequest("Driver email is required");
        var userExists = await db.Users.AnyAsync(u => u.Email.ToLower() == req.DriverEmail.ToLower());
        if (!userExists) return Results.Unauthorized();

        var lastAlert = await db.SosAlerts
            .Where(s => s.DriverEmail.ToLower() == req.DriverEmail.ToLower())
            .OrderByDescending(s => s.Id)
            .FirstOrDefaultAsync();
            
        if (lastAlert != null) {
            lastAlert.Location = req.Location;
            lastAlert.CreatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
        }
        return Results.Ok(new { success = true });
    } catch (Exception ex) {
        return Results.BadRequest(new { error = ex.Message });
    }
});

app.MapPut("/api/sos/update-status", async (AppDbContext db, SosStatusRequest req) => {
    // Update driver break mode and current location
    try {
        // Validate user exists
        if (string.IsNullOrEmpty(req.DriverEmail)) return Results.BadRequest("Driver email is required");
        var userExists = await db.Users.AnyAsync(u => u.Email.ToLower() == req.DriverEmail.ToLower());
        if (!userExists) return Results.Unauthorized();

        var alert = new SosAlert {
            VehicleId = "CURRENT-VEHICLE",
            DriverEmail = req.DriverEmail,
            Type = req.BreakModeActive ? "BreakModeOn" : "BreakModeOff",
            Location = req.Location,
            CreatedAt = DateTime.UtcNow,
            IsActive = req.BreakModeActive
        };
        db.SosAlerts.Add(alert);
        await db.SaveChangesAsync();
        return Results.Ok(new { success = true, sosAlertId = alert.Id });
    } catch (Exception ex) {
        return Results.BadRequest(new { error = ex.Message });
    }
});

// --- REST POINTS (Real nearby amenities using Overpass API) ---
app.MapPost("/api/rest-points", async (IHttpClientFactory clientFactory, RestPointRequest req) => {
    var http = clientFactory.CreateClient();
    
    try {
        // Use Overpass API to find real nearby amenities (cafes, gas stations, parking, tolls)
        // This searches within a 5km radius
        var radius = 5000; // 5km in meters
        var query = $@"[bbox:{req.Latitude - 0.045},{req.Longitude - 0.045},{req.Latitude + 0.045},{req.Longitude + 0.045}];
            (
                node[amenity=cafe](around:{radius},{req.Latitude},{req.Longitude});
                node[amenity=fuel](around:{radius},{req.Latitude},{req.Longitude});
                node[amenity=parking](around:{radius},{req.Latitude},{req.Longitude});
                node[amenity=restaurant](around:{radius},{req.Latitude},{req.Longitude});
            );
            out center;";

        var overpassUrl = $"https://overpass-api.de/api/interpreter?data={Uri.EscapeDataString(query)}";
        var response = await http.GetAsync(overpassUrl);
        
        if (!response.IsSuccessStatusCode) {
            return Results.Ok(new { restPoints = new List<object>() });
        }

        var xmlContent = await response.Content.ReadAsStringAsync();
        
        // Parse Overpass XML response manually (simple extraction)
        var restPoints = new List<dynamic>();
        
        // Extract nodes using simple regex (in production, use proper XML parser)
        var nodePattern = @"<node id=""(\d+)"" lat=""([^""]+)"" lon=""([^""]+)"">";
        var namePattern = @"<tag k=""name"" v=""([^""]+)""/>";
        var amenityPattern = @"<tag k=""amenity"" v=""([^""]+)""/>";
        
        var nodes = System.Text.RegularExpressions.Regex.Matches(xmlContent, nodePattern);
        
        foreach (System.Text.RegularExpressions.Match nodeMatch in nodes) {
            try {
                var lat = double.Parse(nodeMatch.Groups[2].Value);
                var lon = double.Parse(nodeMatch.Groups[3].Value);
                
                // Extract name and amenity type
                var nodeXml = System.Text.RegularExpressions.Regex.Match(xmlContent, 
                    $@"<node id=""{nodeMatch.Groups[1].Value}""[^>]*>.*?</node>", 
                    System.Text.RegularExpressions.RegexOptions.Singleline);
                
                var nameMatch = System.Text.RegularExpressions.Regex.Match(nodeXml.Value, namePattern);
                var amenityMatch = System.Text.RegularExpressions.Regex.Match(nodeXml.Value, amenityPattern);
                
                var name = nameMatch.Success ? nameMatch.Groups[1].Value : "Rest Point";
                var amenityType = amenityMatch.Success ? amenityMatch.Groups[1].Value : "facility";
                
                // Calculate distance using Haversine formula
                var distance = CalculateDistance(req.Latitude, req.Longitude, lat, lon);
                
                // Only include points within 5km
                if (distance <= 5) {
                    var restPoint = new {
                        id = nodeMatch.Groups[1].Value,
                        name = name,
                        type = MapAmenityType(amenityType),
                        lat = lat,
                        lon = lon,
                        distance = distance,
                        duration = (int)(distance * 60 / 80) // Estimate: 80 km/h average speed
                    };
                    restPoints.Add(restPoint);
                }
            } catch { }
        }
        
        // Sort by distance
        restPoints = restPoints.OrderBy(p => p.distance).ToList();
        
        return Results.Ok(new { restPoints = restPoints });
    } catch (Exception ex) {
        Console.WriteLine($"Rest Points Error: {ex.Message}");
        return Results.Ok(new { restPoints = new List<object>() });
    }
});

app.MapControllers();
app.Run();

// Utility: Calculate distance between two coordinates (Haversine formula)
static double CalculateDistance(double lat1, double lon1, double lat2, double lon2) {
    const double R = 6371; // Earth's radius in km
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
            Math.Cos(lat1 * Math.PI / 180) * Math.Cos(lat2 * Math.PI / 180) *
            Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
    var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
    return R * c;
}

// Utility: Map OpenStreetMap amenity types to user-friendly names
static string MapAmenityType(string amenityType) {
    return amenityType switch {
        "cafe" => "Coffee Shop",
        "restaurant" => "Restaurant",
        "fuel" => "Petrol Pump",
        "parking" => "Parking Area",
        "hospital" => "Hospital",
        "pharmacy" => "Pharmacy",
        _ => "Rest Point"
    };
}

// Utility: simple SHA256 password hashing (not a full auth solution, but better than plaintext)
static string HashPassword(string pwd)
{
    if (string.IsNullOrEmpty(pwd)) return "";
    using var sha = SHA256.Create();
    var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(pwd));
    return Convert.ToHexString(bytes);
}

// --- MODELS ---
class AppDbContext : DbContext {
    public AppDbContext(DbContextOptions options) : base(options) { }
    public DbSet<User> Users => Set<User>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<UserSettings> UserSettings => Set<UserSettings>();
    public DbSet<Weather> Weathers => Set<Weather>();
    public DbSet<DeliveryHistory> Histories => Set<DeliveryHistory>();
    public DbSet<SosAlert> SosAlerts => Set<SosAlert>();
}

class User { public int Id { get; set; } public string Email { get; set; } = ""; public string Password { get; set; } = ""; public string PlainPassword { get; set; } = ""; public string Name { get; set; } = ""; public string Phone { get; set; } = ""; public string VehicleId { get; set; } = ""; public string Role { get; set; } = "user"; public string Status { get; set; } = "Active"; }
class LoginRequest { public string Email { get; set; } = ""; public string Password { get; set; } = ""; }
class UserCreate { public string Email { get; set; } = ""; public string Name { get; set; } = ""; public string Password { get; set; } = ""; public string Role { get; set; } = ""; }
class DeliveryHistory { 
    public int Id { get; set; } 
    public string RouteId { get; set; } = ""; 
    public string Date { get; set; } = ""; 
    public string StartTime { get; set; } = ""; 
    public string EndTime { get; set; } = ""; 
    public string Origin { get; set; } = ""; 
    public string Destination { get; set; } = ""; 
    public string Weather { get; set; } = ""; 
    public string Distance { get; set; } = ""; 
    public string Status { get; set; } = ""; 
    public string DriverEmail { get; set; } = "";
    // Extended fields for real-time tracking
    public double? OriginLat { get; set; }
    public double? OriginLon { get; set; }
    public double? DestinationLat { get; set; }
    public double? DestinationLon { get; set; }
    public double? CurrentLat { get; set; }
    public double? CurrentLon { get; set; }
    public string? Eta { get; set; }
    public double? Speed { get; set; }
    public double? Temperature { get; set; }
    public int? Humidity { get; set; }
    public double? WindSpeed { get; set; }
    public double? RainProbability { get; set; }
    public string SafetyScore { get; set; } = "Safe";
    public string WeatherCondition { get; set; } = "";
    public double? Duration { get; set; } // in minutes
    public string Notes { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.Now;
}
class Notification { 
    public int Id { get; set; } 
    public string Category { get; set; } = ""; 
    public string Title { get; set; } = ""; 
    public string Description { get; set; } = ""; 
    public string Timestamp { get; set; } = ""; 
    public string Type { get; set; } = ""; // "WEATHER_ALERT" for weather notifications
    public string Severity { get; set; } = ""; // "HEAVY_RAIN" | "STORM"
    public string? UserEmail { get; set; } // Optional: for user-specific notifications
}
class Weather { public int Id { get; set; } public double Temperature { get; set; } public string Condition { get; set; } = ""; public int Humidity { get; set; } public double WindSpeed { get; set; } public double RainProbability { get; set; } public string SafetyScore { get; set; } = "Safe"; public DateTime RecordedAt { get; set; } = DateTime.Now; public string? UserEmail { get; set; } }
class SosAlert { 
    public int Id { get; set; } 
    public string VehicleId { get; set; } = ""; 
    public string DriverEmail { get; set; } = ""; 
    public string DriverName { get; set; } = "";
    public string Type { get; set; } = ""; 
    public string Location { get; set; } = ""; 
    public string Time { get; set; } = "";  // Keep for DB compatibility
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ResolvedAt { get; set; }
}

// User-specific settings stored in DB
class UserSettings {
    public int Id { get; set; }
    public int UserId { get; set; }
    public string TemperatureUnit { get; set; } = "C"; // "C" or "F"
    public string DistanceUnit { get; set; } = "km"; // "km" or "mi"
    public string TimeFormat { get; set; } = "24"; // "12" or "24"
    public string Language { get; set; } = "en-US";
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class SettingsRequest { public string? TemperatureUnit { get; set; } public string? DistanceUnit { get; set; } public string? TimeFormat { get; set; } public string? Language { get; set; } }

public class RouteRequest { public string Origin { get; set; } = ""; public string Destination { get; set; } = ""; }
public class SaveWeatherRequest { public double Temperature { get; set; } public string Condition { get; set; } = ""; public int Humidity { get; set; } public double WindSpeed { get; set; } public double RainProbability { get; set; } public string SafetyScore { get; set; } = "Safe"; public string? UserEmail { get; set; } }
public class SosTrackingRequest { public string DriverEmail { get; set; } = ""; public string Location { get; set; } = ""; public string Timestamp { get; set; } = ""; public bool IsMoving { get; set; } }
public class SosStatusRequest { public string DriverEmail { get; set; } = ""; public bool BreakModeActive { get; set; } public string Location { get; set; } = ""; public string Timestamp { get; set; } = ""; }
public class SosCreateRequest { public string DriverEmail { get; set; } = ""; public string? VehicleId { get; set; } public string Type { get; set; } = ""; public string Location { get; set; } = ""; }
public class RestPointRequest { public double Latitude { get; set; } public double Longitude { get; set; } }
public class SaveDeliveryHistoryRequest { 
    public string RouteId { get; set; } = ""; 
    public string Date { get; set; } = ""; 
    public string StartTime { get; set; } = ""; 
    public string EndTime { get; set; } = ""; 
    public string Origin { get; set; } = ""; 
    public string Destination { get; set; } = ""; 
    public double? OriginLat { get; set; }
    public double? OriginLon { get; set; }
    public double? DestinationLat { get; set; }
    public double? DestinationLon { get; set; }
    public string Weather { get; set; } = "";
    public string WeatherCondition { get; set; } = "";
    public double? Temperature { get; set; }
    public int? Humidity { get; set; }
    public double? WindSpeed { get; set; }
    public double? RainProbability { get; set; }
    public string SafetyScore { get; set; } = "Safe";
    public string Distance { get; set; } = "";
    public double? Duration { get; set; }
    public string Status { get; set; } = "Completed";
    public string DriverEmail { get; set; } = "";
    public string Notes { get; set; } = "";
    // Optional real-time telemetry
    public double? CurrentLat { get; set; }
    public double? CurrentLon { get; set; }
    public string? Eta { get; set; }
    public double? Speed { get; set; }
}
public class Coord { public double Lat { get; set; } public double Lon { get; set; } }
public class PythonResponse { public double safety_score { get; set; } public double rain_prob { get; set; } public string condition { get; set; } = ""; }
public class OsrmResponse { public List<RouteItem> routes { get; set; } = new(); }
public class RouteItem { public OsrmGeometry geometry { get; set; } = new(); public double duration { get; set; } public double distance { get; set; } }
public class OsrmGeometry { public List<List<double>> coordinates { get; set; } = new(); }
public class UpdateLocationRequest { public int TripId { get; set; } public double Latitude { get; set; } public double Longitude { get; set; } public double Speed { get; set; } public string? Eta { get; set; } }