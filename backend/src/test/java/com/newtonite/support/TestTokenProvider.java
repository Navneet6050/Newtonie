package com.newtonite.support;

import com.newtonite.security.JwtService;
import com.newtonite.team.User;
import com.newtonite.team.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
public class TestTokenProvider {

    @Autowired
    private JwtService jwtService;

    @Autowired
    private UserRepository userRepository;

    public String bearerTokenFor(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("Test user not found: " + email));
        return "Bearer " + jwtService.generateToken(user);
    }

    public String alexMorganToken() {
        return bearerTokenFor("alex.morgan@acme.internal");
    }

    public String sarahChenToken() {
        return bearerTokenFor("sarah.chen@acme.internal");
    }

    public String liamVanceToken() {
        return bearerTokenFor("liam.vance@acme.internal");
    }
}
