using Microsoft.AspNetCore.Mvc;
using SelfStorageAPI.DTOs;
using SelfStorageAPI.Interfaces;

namespace SelfStorageAPI.Controllers;

[Route("api/[controller]")]
[ApiController]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequestDTO request)
    {
        var result = await _authService.LoginAsync(request);

        if (!result.IsSuccess)
        {
            if (result.ErrorMessage == "Tài khoản chưa được kích hoạt hoặc đã bị khóa.")
                return Forbid();
            return Unauthorized(new { message = result.ErrorMessage });
        }

        return Ok(result.User);
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequestDTO request)
    {
        var result = await _authService.RegisterAsync(request);

        if (!result.IsSuccess)
        {
            return BadRequest(new { message = result.ErrorMessage });
        }

        return Ok(new { message = result.ErrorMessage });
    }
}
