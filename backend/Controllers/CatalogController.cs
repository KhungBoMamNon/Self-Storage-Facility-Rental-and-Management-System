using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SelfStorageAPI.Data;
using System.Linq;
using System.Threading.Tasks;

namespace SelfStorageAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CatalogController : ControllerBase
    {
        private readonly SelfStorageDbContext _context;

        public CatalogController(SelfStorageDbContext context)
        {
            _context = context;
        }

        [HttpGet("state")]
        public async Task<IActionResult> GetCatalogState()
        {
            try
            {
                var facilities = await _context.Facilities
                    .Select(f => new {
                        id = f.FacilityID.ToString(),
                        name = f.FacilityName,
                        address = f.Address,
                        status = f.Status,
                        locations = new string[] { "Khu A", "Khu B" } // Mock location for frontend
                    }).ToListAsync();

                var units = await _context.StorageUnits
                    .Include(u => u.UnitType)
                    .Include(u => u.UnitSize)
                    .Select(u => new {
                        id = u.UnitNumber,
                        facility = u.FacilityID.ToString(),
                        type = u.UnitType.TypeName,
                        climate = u.UnitType.TypeName, // Frontend uses climate matching type
                        size = u.UnitSize.Dimensions,
                        price = u.BasePrice,
                        status = u.Status,
                        location = "Khu A" // Mock location
                    }).ToListAsync();

                return Ok(new {
                    facilities,
                    units
                });
            }
            catch (System.Exception ex)
            {
                return StatusCode(500, new { message = "Lỗi khi lấy dữ liệu từ cơ sở dữ liệu", error = ex.Message });
            }
        }
    }
}
