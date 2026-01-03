namespace ClimaRouteAPI.Models
{
    // 1. AUTH & USERS (For Login & ManageUsers.tsx)
    public class User
    {
        public int Id { get; set; }
        public required string Name { get; set; }
        public required string Email { get; set; }
        public required string Password { get; set; }
        public required string Role { get; set; } // "admin" or "user"
        public required string Status { get; set; } // "Active", "On Leave"
        public required string Phone { get; set; } // User phone number
        public required string VehicleId { get; set; } // Fleet/Vehicle ID assigned to user
        public required string PlainPassword { get; set; } // Stored password for display (demo only)
        public DateTime? UpdatedAt { get; set; } // Last update timestamp
    }

    public class LoginRequest
    {
        public required string Email { get; set; }
        public required string Password { get; set; }
    }

    // 2. ADMIN DASHBOARD (For AdminDashboard.tsx)
    public class DashboardStats
    {
        public int ActiveFleet { get; set; }
        public int ActiveAlerts { get; set; }
        public int TotalDrivers { get; set; }
        public required string SystemHealth { get; set; }
        public required List<ChartData> WeeklyVolume { get; set; }
    }
    public class ChartData
    {
        public required string Name { get; set; }
        public int Trips { get; set; }
    }

    // 3. FLEET & MAPS (For FleetLiveMonitor.tsx)
    public class VehiclePosition
    {
        public required string Id { get; set; }
        public double Lat { get; set; }
        public double Lon { get; set; }
        public required string Status { get; set; } // "Moving", "Idle", "SOS"
        public required string Heading { get; set; }
    }

    // 4. ALERTS & SOS (For EmergencyAlerts.tsx & SOS.tsx)
    public class SosAlert
    {
        public required string Id { get; set; }
        public required string VehicleId { get; set; }
        public required string Type { get; set; } // "Medical", "Mechanical", "Theft"
        public required string Location { get; set; }
        public required string Time { get; set; }
        public bool IsActive { get; set; }
    }

    // 5. UTILITIES (For RestPoint.tsx, Notifications.tsx)
    public class NotificationItem
    {
        public required string Id { get; set; }
        public required string Category { get; set; } // "Critical", "Route", "System"
        public required string Title { get; set; }
        public required string Description { get; set; }
        public required string Timestamp { get; set; }
        public bool Read { get; set; }
    }

    public class RestPointItem
    {
        public required string Id { get; set; }
        public required string Name { get; set; }
        public required string Type { get; set; }
        public required string Distance { get; set; }
        public required string SafetyRating { get; set; }
        public required List<string> Facilities { get; set; }
    }

    // 6. OPERATIONS (For AdaptiveSpeed.tsx)
    public class SpeedData
    {
        public required string SegmentName { get; set; }
        public int CurrentSpeed { get; set; }
        public int RecommendedSpeed { get; set; }
        public required string RiskLevel { get; set; }
    }
}