<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GitHub Pages Repositories</title>
    <!-- Adicionando Bootstrap CSS -->
    <link href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css" rel="stylesheet">
    <style>
        body {
            padding: 20px;
        }

        .repo-item {
            margin-bottom: 20px;
        }

        .repo-info {
            padding-left: 20px;
        }

        .success {
            color: #28a745;
        }

        .error {
            color: #dc3545;
        }

        .not-found {
            color: #dc3545;
        }

        .not-found.yellow {
            color: #ffc107;
        }
    </style>
</head>

<body>
    <h1>GitHub Pages Repositories</h1>
    <ul id="repo-list" class="list-unstyled">
        <?php
        $username = 'omartins-zs';
        $token = ''; // Opcional

        function fetchWithToken($url, $token)
        {
            $headers = [
                'Accept: application/vnd.github.v3+json',
                'User-Agent: PHP'
            ];
            if ($token) {
                $headers[] = 'Authorization: token ' . $token;
            }
            $options = [
                'http' => [
                    'header' => implode("\r\n", $headers),
                ]
            ];
            $context = stream_context_create($options);
            $response = @file_get_contents($url, false, $context);
            if ($response === FALSE) {
                throw new Exception("HTTP error!");
            }
            return json_decode($response, true);
        }

        function getRepos($username, $token)
        {
            $url = "https://api.github.com/users/$username/repos";
            return fetchWithToken($url, $token);
        }

        function checkGitHubPages($repo, $username)
        {
            $pagesUrl = "https://$username.github.io/{$repo['name']}/";
            $headers = get_headers($pagesUrl, 1);
            $status = substr($headers[0], 9, 3);

            if ($status == '404' && isset($headers['Content-Length']) && $headers['Content-Length'] > 0) {
                return ['url' => $pagesUrl, 'status' => 404, 'hosted' => true];
            }
            return ['url' => $pagesUrl, 'status' => (int)$status];
        }

        function listGitHubPagesRepos($username, $token)
        {
            try {
                $repos = getRepos($username, $token);
                foreach ($repos as $repo) {
                    $result = checkGitHubPages($repo, $username);
                    echo '<li class="repo-item">';
                    echo '<h3>' . htmlspecialchars($repo['name']) . '</h3>';
                    echo '<h4 class="' . getStatusClass($result['status'], $result['hosted']) . '">' . $result['status'] . ' (' . getStatusText($result['status']) . ')</h4>';
                    echo '<div class="repo-info">';
                    if ($result['status'] === 200) {
                        echo 'Projeto hospedado no GitHub Pages<br>URL: <a href="' . htmlspecialchars($result['url']) . '" target="_blank">' . htmlspecialchars($result['url']) . '</a>';
                    } elseif ($result['status'] === 404) {
                        if ($result['hosted']) {
                            echo 'Projeto Hospedado - Arquivo não encontrado';
                        } else {
                            echo 'Página não Encontrada - Não Hospedado';
                        }
                    } else {
                        echo 'Erro ao acessar o GitHub Pages: ' . $result['status'];
                    }
                    echo '</div>';
                    echo '</li>';
                }
            } catch (Exception $e) {
                echo '<p class="error">Error fetching repositories: ' . $e->getMessage() . '</p>';
            }
        }

        function getStatusText($statusCode)
        {
            switch ($statusCode) {
                case 200:
                    return 'Ok';
                case 404:
                    return 'Not Found';
                default:
                    return 'Error';
            }
        }

        function getStatusClass($statusCode, $hosted)
        {
            switch ($statusCode) {
                case 200:
                    return 'success';
                case 404:
                    return $hosted ? 'not-found yellow' : 'not-found';
                default:
                    return 'error';
            }
        }

        listGitHubPagesRepos($username, $token);
        ?>
    </ul>
</body>

</html>